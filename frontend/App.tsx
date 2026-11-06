import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';

import database, { collections, Record as RecordModel } from './src/db';
import {
  AnalyticsScreen,
  RecordFormScreen,
  RecordTimelineScreen,
  SettingsScreen,
} from './src/screens';
import { ensureInitialChildAndUser, syncDatabase } from './src/services';
import {
  buildAppTheme,
  ChildColorTheme,
  ThemeContext,
  ThemeMode,
} from './src/theme';
import { RecordCategory } from './src/types';

type MainTab = 'timeline' | 'analytics' | 'settings';

const NAV_ITEMS: ReadonlyArray<{
  key: MainTab;
  icon: string;
  label: string;
}> = [
  { key: 'timeline', icon: '📒', label: 'タイムライン' },
  { key: 'analytics', icon: '📊', label: 'グラフ・成長曲線' },
  { key: 'settings', icon: '⚙️', label: '設定・管理' },
];

export default function App(): React.JSX.Element {
  const { width } = useWindowDimensions();
  const isCompactHeader = width < 720;

  const [activeTab, setActiveTab] = useState<MainTab>('timeline');
  const [isHamburgerOpen, setIsHamburgerOpen] = useState<boolean>(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeChildName, setActiveChildName] = useState<string>('');
  const [activeUserName, setActiveUserName] = useState<string>('');
  const [activeChildColorTheme, setActiveChildColorTheme] =
    useState<ChildColorTheme>(ChildColorTheme.PINK);
  const [activeUserThemeMode, setActiveUserThemeMode] = useState<ThemeMode>(
    ThemeMode.LIGHT
  );
  const [initError, setInitError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [defaultCategory, setDefaultCategory] = useState<
    RecordCategory | undefined
  >(undefined);
  const [editingRecord, setEditingRecord] = useState<RecordModel | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { child, user } = await ensureInitialChildAndUser();
        if (!mounted) {
          return;
        }
        setActiveChildId(child.id);
        setActiveUserId(user.id);
        setActiveChildName(child.name);
        setActiveChildColorTheme(child.resolvedColorTheme);
        setActiveUserName(user.name);
        setActiveUserThemeMode(user.resolvedThemeMode);

        // 起動時にバックグラウンドで FastAPI との同期を試行（オフラインでもエラーにしない）
        void syncDatabase({ childId: child.id });
      } catch (err) {
        console.error('[App] Failed to initialize WatermelonDB:', err);
        if (mounted) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  // 表示中の子どものカラーテーマ変更をリアルタイム監視
  useEffect(() => {
    if (!activeChildId) return;
    const subscription = collections.children
      .findAndObserve(activeChildId)
      .subscribe({
        next: (child) => {
          setActiveChildName(child.name);
          setActiveChildColorTheme(child.resolvedColorTheme);
        },
        error: () => {
          // 削除時などの一時的な未検出は無視
        },
      });
    return () => subscription.unsubscribe();
  }, [activeChildId]);

  // 表示中のユーザーのライト／ダークモード変更をリアルタイム監視
  useEffect(() => {
    if (!activeUserId) return;
    const subscription = collections.users
      .findAndObserve(activeUserId)
      .subscribe({
        next: (user) => {
          setActiveUserName(user.name);
          setActiveUserThemeMode(user.resolvedThemeMode);
        },
        error: () => {
          // 削除時などの一時的な未検出は無視
        },
      });
    return () => subscription.unsubscribe();
  }, [activeUserId]);

  // 画面幅が広がったらハンバーガーメニューを自動で閉じる
  useEffect(() => {
    if (!isCompactHeader && isHamburgerOpen) {
      setIsHamburgerOpen(false);
    }
  }, [isCompactHeader, isHamburgerOpen]);

  const appTheme = useMemo(
    () => buildAppTheme(activeChildColorTheme, activeUserThemeMode),
    [activeChildColorTheme, activeUserThemeMode]
  );

  const handleSelectNavTab = (tab: MainTab) => {
    setActiveTab(tab);
    setIsHamburgerOpen(false);
  };

  const handleOpenCreateModal = (category?: RecordCategory) => {
    setEditingRecord(null);
    setDefaultCategory(category);
    setIsFormVisible(true);
  };

  const handleOpenEditModal = (record: RecordModel) => {
    setEditingRecord(record);
    setDefaultCategory(record.category);
    setIsFormVisible(true);
  };

  const handleCloseFormModal = () => {
    setIsFormVisible(false);
    setEditingRecord(null);
  };

  return (
    <DatabaseProvider database={database}>
      <ThemeContext.Provider value={appTheme}>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: appTheme.bgHeader }]}
        >
          <StatusBar
            barStyle={appTheme.isDark ? 'light-content' : 'dark-content'}
          />
          {!activeChildId ? (
            <View
              style={[
                styles.loadingContainer,
                { backgroundColor: appTheme.bgScreen },
              ]}
            >
              {initError ? (
                <Text
                  style={[styles.loadingText, { color: appTheme.dangerText }]}
                >
                  DB初期化エラー: {initError}
                </Text>
              ) : (
                <>
                  <ActivityIndicator size="large" color={appTheme.primary} />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: appTheme.textSecondary },
                    ]}
                  >
                    ローカルデータベース (WatermelonDB) を初期化中...
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.mainLayout,
                { backgroundColor: appTheme.bgScreen },
              ]}
            >
              {/* ヘッダーナビゲーションバー */}
              <View
                style={[
                  styles.headerNav,
                  {
                    backgroundColor: appTheme.bgHeader,
                    borderBottomColor: appTheme.border,
                  },
                ]}
              >
                <View style={styles.brandGroup}>
                  <View
                    style={[
                      styles.childColorIndicator,
                      { backgroundColor: appTheme.palette.swatch },
                    ]}
                  />
                  <Text
                    style={[styles.brandTitle, { color: appTheme.textPrimary }]}
                  >
                    KodomoTracker
                  </Text>
                  {activeChildName ? (
                    <View
                      style={[
                        styles.contextBadge,
                        {
                          backgroundColor: appTheme.primarySoftBg,
                          borderColor: appTheme.primaryBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.contextBadgeText,
                          { color: appTheme.primary },
                        ]}
                        numberOfLines={1}
                      >
                        👶 {activeChildName}
                        {activeUserName
                          ? ` / ${appTheme.isDark ? '🌙' : '☀️'} ${activeUserName}`
                          : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 画面幅が広い場合: ヘッダー内に横並びメニューを表示 */}
                {!isCompactHeader ? (
                  <View style={styles.headerMenuRow}>
                    {NAV_ITEMS.map((item) => {
                      const isActive = activeTab === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.headerNavTab,
                            isActive && {
                              backgroundColor: appTheme.primarySoftBg,
                              borderColor: appTheme.primaryBorder,
                            },
                          ]}
                          onPress={() => handleSelectNavTab(item.key)}
                        >
                          <Text style={styles.headerNavIcon}>{item.icon}</Text>
                          <Text
                            style={[
                              styles.headerNavLabel,
                              {
                                color: isActive
                                  ? appTheme.primary
                                  : appTheme.textSecondary,
                              },
                              isActive && styles.headerNavLabelActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  /* 画面幅が小さい場合: 三本線のハンバーガーアイコンを表示 */
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="メニューを開く"
                    style={[
                      styles.hamburgerButton,
                      {
                        backgroundColor: isHamburgerOpen
                          ? appTheme.primarySoftBg
                          : appTheme.bgElevated,
                        borderColor: isHamburgerOpen
                          ? appTheme.primaryBorder
                          : appTheme.borderStrong,
                      },
                    ]}
                    onPress={() => setIsHamburgerOpen((prev) => !prev)}
                  >
                    <View style={styles.hamburgerIconBox}>
                      <View
                        style={[
                          styles.hamburgerBar,
                          {
                            backgroundColor: isHamburgerOpen
                              ? appTheme.primary
                              : appTheme.textPrimary,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.hamburgerBar,
                          {
                            backgroundColor: isHamburgerOpen
                              ? appTheme.primary
                              : appTheme.textPrimary,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.hamburgerBar,
                          {
                            backgroundColor: isHamburgerOpen
                              ? appTheme.primary
                              : appTheme.textPrimary,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* ハンバーガーアイコン押下時のドロップダウンメニュー (狭幅時のみ) */}
              {isCompactHeader && isHamburgerOpen ? (
                <View
                  style={[
                    styles.hamburgerDropdown,
                    {
                      backgroundColor: appTheme.bgHeader,
                      borderBottomColor: appTheme.borderStrong,
                    },
                  ]}
                >
                  {NAV_ITEMS.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.hamburgerMenuItem,
                          { borderBottomColor: appTheme.border },
                          isActive && {
                            backgroundColor: appTheme.primarySoftBg,
                          },
                        ]}
                        onPress={() => handleSelectNavTab(item.key)}
                      >
                        <Text style={styles.hamburgerMenuIcon}>
                          {item.icon}
                        </Text>
                        <Text
                          style={[
                            styles.hamburgerMenuLabel,
                            {
                              color: isActive
                                ? appTheme.primary
                                : appTheme.textPrimary,
                            },
                            isActive && styles.headerNavLabelActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isActive ? (
                          <Text
                            style={[
                              styles.hamburgerActiveMark,
                              { color: appTheme.primary },
                            ]}
                          >
                            ● 表示中
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* メインコンテンツ領域 */}
              <View style={styles.contentArea}>
                {activeTab === 'timeline' ? (
                  <RecordTimelineScreen
                    childId={activeChildId}
                    onOpenCreateModal={handleOpenCreateModal}
                    onEditRecord={handleOpenEditModal}
                  />
                ) : null}

                {activeTab === 'analytics' ? (
                  <AnalyticsScreen
                    childId={activeChildId}
                    activeUserId={activeUserId}
                    onOpenCreateModal={handleOpenCreateModal}
                    onEditRecord={handleOpenEditModal}
                  />
                ) : null}

                {activeTab === 'settings' ? (
                  <SettingsScreen
                    activeChildId={activeChildId}
                    activeUserId={activeUserId}
                    onSelectChild={setActiveChildId}
                    onSelectUser={setActiveUserId}
                  />
                ) : null}
              </View>

              <Modal
                visible={isFormVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseFormModal}
              >
                <SafeAreaView
                  style={[
                    styles.modalSafeArea,
                    { backgroundColor: appTheme.bgScreen },
                  ]}
                >
                  <RecordFormScreen
                    childId={activeChildId}
                    recordedBy={activeUserId}
                    initialCategory={defaultCategory}
                    editingRecord={editingRecord}
                    onSaved={handleCloseFormModal}
                    onCancel={handleCloseFormModal}
                  />
                </SafeAreaView>
              </Modal>
            </View>
          )}
        </SafeAreaView>
      </ThemeContext.Provider>
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainLayout: {
    flex: 1,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  childColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  contextBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 220,
  },
  contextBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerNavIcon: {
    fontSize: 15,
  },
  headerNavLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerNavLabelActive: {
    fontWeight: '800',
  },
  hamburgerButton: {
    width: 40,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIconBox: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
  },
  hamburgerBar: {
    width: 18,
    height: 2.2,
    borderRadius: 2,
  },
  hamburgerDropdown: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 19,
  },
  hamburgerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  hamburgerMenuIcon: {
    fontSize: 16,
  },
  hamburgerMenuLabel: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  hamburgerActiveMark: {
    fontSize: 11,
    fontWeight: '800',
  },
  contentArea: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
