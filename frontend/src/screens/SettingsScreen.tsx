import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';

import { Child, collections, User } from '../db';
import {
  CHILD_COLOR_PALETTES,
  CHILD_COLOR_THEME_LIST,
  ChildColorTheme,
  THEME_MODE_LABELS,
  ThemeMode,
  useAppTheme,
} from '../theme';
import {
  Gender,
  GENDER_LABELS,
  RELATIONSHIP_LABELS,
  RelationshipType,
  USER_ROLE_LABELS,
  UserRole,
} from '../types';
import {
  createChildOffline,
  createUserOffline,
  deleteChildOffline,
  deleteUserOffline,
  syncDatabase,
  updateChildOffline,
  updateUserOffline,
} from '../services';

export interface SettingsScreenExternalProps {
  activeChildId: string;
  activeUserId: string | null;
  onSelectChild: (childId: string) => void;
  onSelectUser: (userId: string) => void;
}

interface SettingsScreenInjectedProps extends SettingsScreenExternalProps {
  childrenList: Child[];
  usersList: User[];
}

function calculateAgeText(birthDateStr: string): string {
  const birth = new Date(`${birthDateStr}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return '';
  }
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    return '出生前';
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) {
    return `生後${months}ヶ月`;
  }
  return `${years}歳${remMonths}ヶ月 (生後${months}ヶ月)`;
}

const RawSettingsScreen: React.FC<SettingsScreenInjectedProps> = ({
  activeChildId,
  activeUserId,
  onSelectChild,
  onSelectUser,
  childrenList,
  usersList,
}) => {
  const theme = useAppTheme();
  const [activeTab, setActiveTab] = useState<'children' | 'users'>('children');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // --- 子どもの新規登録フォーム State ---
  const [isAddingChild, setIsAddingChild] = useState<boolean>(false);
  const [newChildName, setNewChildName] = useState<string>('');
  const [newChildGender, setNewChildGender] = useState<Gender>(Gender.FEMALE);
  const [newChildBirthDate, setNewChildBirthDate] =
    useState<string>('2026-01-15');
  const [newChildColorTheme, setNewChildColorTheme] = useState<ChildColorTheme>(
    ChildColorTheme.PINK
  );

  // --- 子どもの編集フォーム State ---
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState<string>('');
  const [editChildGender, setEditChildGender] = useState<Gender>(Gender.FEMALE);
  const [editChildBirthDate, setEditChildBirthDate] = useState<string>('');
  const [editChildColorTheme, setEditChildColorTheme] =
    useState<ChildColorTheme>(ChildColorTheme.BLUE);

  // --- 削除確認中の子ども ID ---
  const [confirmDeleteChildId, setConfirmDeleteChildId] = useState<
    string | null
  >(null);

  // --- ユーザーの編集フォーム State ---
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState<string>('');
  const [editUserRelationship, setEditUserRelationship] =
    useState<RelationshipType>(RelationshipType.MOTHER);
  const [editUserRole, setEditUserRole] = useState<UserRole>(UserRole.ADMIN);
  const [editUserThemeMode, setEditUserThemeMode] = useState<ThemeMode>(
    ThemeMode.LIGHT
  );

  // --- ユーザーの新規追加フォーム State ---
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRelationship, setNewUserRelationship] =
    useState<RelationshipType>(RelationshipType.FATHER);
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.EDITOR);
  const [newUserThemeMode, setNewUserThemeMode] = useState<ThemeMode>(
    ThemeMode.LIGHT
  );

  const showBanner = useCallback((msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  // --- 子ども操作ハンドラ ---
  const handleStartEditChild = useCallback((child: Child) => {
    setEditingChildId(child.id);
    setEditChildName(child.name);
    setEditChildGender(child.gender);
    setEditChildBirthDate(child.birthDate);
    setEditChildColorTheme(child.resolvedColorTheme);
    setConfirmDeleteChildId(null);
  }, []);

  const handleSaveEditChild = useCallback(
    async (child: Child) => {
      if (!editChildName.trim() || !editChildBirthDate.trim()) {
        showBanner('⚠️ 名前と生年月日 (YYYY-MM-DD) を入力してください');
        return;
      }
      await updateChildOffline(child, {
        name: editChildName,
        gender: editChildGender,
        birthDate: editChildBirthDate,
        colorTheme: editChildColorTheme,
      });
      setEditingChildId(null);
      showBanner(`✅ 「${editChildName.trim()}」の登録情報を更新しました`);
      void syncDatabase({ childId: child.id });
    },
    [
      editChildBirthDate,
      editChildColorTheme,
      editChildGender,
      editChildName,
      showBanner,
    ]
  );

  const handleQuickChangeChildColor = useCallback(
    async (child: Child, colorTheme: ChildColorTheme) => {
      await updateChildOffline(child, { colorTheme });
      const palette = CHILD_COLOR_PALETTES[colorTheme];
      showBanner(
        `🎨 「${child.name}」のカラーテーマを「${palette.label}」に設定しました`
      );
      void syncDatabase({ childId: child.id });
    },
    [showBanner]
  );

  const handleCreateChild = useCallback(async () => {
    if (!newChildName.trim() || !newChildBirthDate.trim()) {
      showBanner('⚠️ 名前と生年月日 (YYYY-MM-DD) を入力してください');
      return;
    }
    const created = await createChildOffline({
      name: newChildName,
      gender: newChildGender,
      birthDate: newChildBirthDate,
      colorTheme: newChildColorTheme,
    });
    setNewChildName('');
    setIsAddingChild(false);
    onSelectChild(created.id);
    showBanner(`🎉 「${created.name}」を新規登録し、表示対象に切り替えました`);
    void syncDatabase({ childId: created.id });
  }, [
    newChildBirthDate,
    newChildColorTheme,
    newChildGender,
    newChildName,
    onSelectChild,
    showBanner,
  ]);

  const handleConfirmDeleteChild = useCallback(
    async (child: Child) => {
      const deletedName = child.name;
      const remaining = childrenList.filter((c) => c.id !== child.id);
      await deleteChildOffline(child);
      setConfirmDeleteChildId(null);
      setEditingChildId(null);

      if (remaining.length > 0) {
        if (activeChildId === child.id) {
          onSelectChild(remaining[0].id);
        }
      } else {
        // 全て削除された場合はデフォルトの子どもを再作成して空参照を防ぐ
        const fallback = await createChildOffline({
          name: 'はるか',
          gender: Gender.FEMALE,
          birthDate: '2026-01-15',
          colorTheme: ChildColorTheme.PINK,
        });
        onSelectChild(fallback.id);
      }
      showBanner(`🗑️ 「${deletedName}」の登録情報を削除しました`);
      void syncDatabase();
    },
    [activeChildId, childrenList, onSelectChild, showBanner]
  );

  // --- ユーザー操作ハンドラ ---
  const handleStartEditUser = useCallback((user: User) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserRelationship(user.relationship);
    setEditUserRole(user.role);
    setEditUserThemeMode(user.resolvedThemeMode);
  }, []);

  const handleSaveEditUser = useCallback(
    async (user: User) => {
      if (!editUserName.trim()) {
        showBanner('⚠️ ユーザー名を入力してください');
        return;
      }
      await updateUserOffline(user, {
        name: editUserName,
        relationship: editUserRelationship,
        role: editUserRole,
        themeMode: editUserThemeMode,
      });
      setEditingUserId(null);
      showBanner(`✅ ユーザー「${editUserName.trim()}」の情報を更新しました`);
      void syncDatabase({ childId: activeChildId });
    },
    [
      activeChildId,
      editUserName,
      editUserRelationship,
      editUserRole,
      editUserThemeMode,
      showBanner,
    ]
  );

  const handleQuickChangeUserThemeMode = useCallback(
    async (user: User, themeMode: ThemeMode) => {
      await updateUserOffline(user, { themeMode });
      showBanner(
        `🌓 「${user.name}」の表示モードを「${THEME_MODE_LABELS[themeMode]}」に設定しました`
      );
      void syncDatabase({ childId: activeChildId });
    },
    [activeChildId, showBanner]
  );

  const handleCreateUser = useCallback(async () => {
    if (!newUserName.trim()) {
      showBanner('⚠️ ユーザー名を入力してください');
      return;
    }
    const created = await createUserOffline({
      name: newUserName,
      relationship: newUserRelationship,
      role: newUserRole,
      themeMode: newUserThemeMode,
    });
    setNewUserName('');
    setIsAddingUser(false);
    onSelectUser(created.id);
    showBanner(`🎉 ユーザー「${created.name}」を追加し、現在の記録者に設定しました`);
    void syncDatabase({ childId: activeChildId });
  }, [
    activeChildId,
    newUserName,
    newUserRelationship,
    newUserRole,
    newUserThemeMode,
    onSelectUser,
    showBanner,
  ]);

  const handleDeleteUser = useCallback(
    async (user: User) => {
      if (usersList.length <= 1) {
        showBanner('⚠️ 最低1名のユーザーが必要です');
        return;
      }
      const deletedName = user.name;
      const remaining = usersList.filter((u) => u.id !== user.id);
      await deleteUserOffline(user);
      if (activeUserId === user.id && remaining.length > 0) {
        onSelectUser(remaining[0].id);
      }
      showBanner(`🗑️ ユーザー「${deletedName}」を削除しました`);
      void syncDatabase({ childId: activeChildId });
    },
    [activeChildId, activeUserId, onSelectUser, showBanner, usersList]
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgScreen }]}>
      {/* トップバー */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.bgCard, borderBottomColor: theme.border },
        ]}
      >
        <View>
          <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
            ⚙️ 設定・プロフィール管理
          </Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
            子どもの登録・カラーテーマ設定、およびユーザーのライト／ダークモード設定
          </Text>
        </View>
      </View>

      {/* サブタブ切り替え */}
      <View
        style={[
          styles.tabRow,
          { backgroundColor: theme.bgCard, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            { backgroundColor: theme.bgElevated },
            activeTab === 'children' && {
              backgroundColor: theme.primaryButtonBg,
            },
          ]}
          onPress={() => setActiveTab('children')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: theme.textSecondary },
              activeTab === 'children' && styles.tabButtonTextActive,
            ]}
          >
            👶 子どもの管理・カラーテーマ ({childrenList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            { backgroundColor: theme.bgElevated },
            activeTab === 'users' && {
              backgroundColor: theme.primaryButtonBg,
            },
          ]}
          onPress={() => setActiveTab('users')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: theme.textSecondary },
              activeTab === 'users' && styles.tabButtonTextActive,
            ]}
          >
            👤 ユーザー情報・表示モード ({usersList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {feedbackMessage ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: theme.primarySoftBg,
              borderBottomColor: theme.primaryBorder,
            },
          ]}
        >
          <Text style={[styles.feedbackText, { color: theme.primary }]}>
            {feedbackMessage}
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'children' ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                登録されている子ども一覧
              </Text>
              <TouchableOpacity
                style={[
                  styles.addPrimaryButton,
                  isAddingChild
                    ? {
                        backgroundColor: theme.dangerSoftBg,
                        borderWidth: 1,
                        borderColor: theme.dangerBorder,
                      }
                    : { backgroundColor: theme.primaryButtonBg },
                ]}
                onPress={() => setIsAddingChild((prev) => !prev)}
              >
                <Text
                  style={[
                    styles.addPrimaryButtonText,
                    isAddingChild && { color: theme.dangerText },
                  ]}
                >
                  {isAddingChild ? '✕ キャンセル' : '＋ 子どもを新規登録'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 子どもの新規登録フォーム */}
            {isAddingChild ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.primaryBorder,
                  },
                ]}
              >
                <Text style={[styles.formCardTitle, { color: theme.textPrimary }]}>
                  👶 新しい子どもの登録
                </Text>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  お名前（ニックネーム可）
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.bgInput,
                      borderColor: theme.borderStrong,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={newChildName}
                  onChangeText={setNewChildName}
                  placeholder="例: はるか、そうた"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  性別（成長曲線の統計基準に利用）
                </Text>
                <View style={styles.optionRow}>
                  {(Object.values(Gender) as Gender[]).map((g) => {
                    const isSelected = newChildGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor: theme.bgInput,
                            borderColor: theme.borderStrong,
                          },
                          isSelected && {
                            backgroundColor: theme.primaryButtonBg,
                            borderColor: theme.primaryButtonBg,
                          },
                        ]}
                        onPress={() => setNewChildGender(g)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            { color: theme.textSecondary },
                            isSelected && styles.optionChipTextActive,
                          ]}
                        >
                          {GENDER_LABELS[g]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  生年月日 (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.bgInput,
                      borderColor: theme.borderStrong,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={newChildBirthDate}
                  onChangeText={setNewChildBirthDate}
                  placeholder="例: 2026-01-15"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  🎨 子どものカラーテーマ（画面アクセント・ボタン色に反映）
                </Text>
                <View style={styles.optionWrap}>
                  {CHILD_COLOR_THEME_LIST.map((palette) => {
                    const isSelected = newChildColorTheme === palette.key;
                    return (
                      <TouchableOpacity
                        key={palette.key}
                        style={[
                          styles.colorThemeChip,
                          {
                            backgroundColor: isSelected
                              ? theme.isDark
                                ? palette.darkSoftBg
                                : palette.lightSoftBg
                              : theme.bgInput,
                            borderColor: isSelected
                              ? palette.swatch
                              : theme.borderStrong,
                          },
                        ]}
                        onPress={() => setNewChildColorTheme(palette.key)}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: palette.swatch },
                          ]}
                        />
                        <Text
                          style={[
                            styles.colorThemeChipText,
                            {
                              color: isSelected
                                ? theme.isDark
                                  ? palette.darkAccent
                                  : palette.lightAccent
                                : theme.textSecondary,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {palette.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      {
                        backgroundColor: theme.bgCard,
                        borderColor: theme.dangerBorder,
                      },
                    ]}
                    onPress={() => setIsAddingChild(false)}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        { color: theme.dangerText },
                      ]}
                    >
                      キャンセル
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: theme.primaryButtonBg },
                    ]}
                    onPress={handleCreateChild}
                  >
                    <Text style={styles.saveButtonText}>登録する</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* 子ども一覧カード */}
            {childrenList.map((child) => {
              const isSelected = child.id === activeChildId;
              const isEditing = editingChildId === child.id;
              const isConfirmingDelete = confirmDeleteChildId === child.id;
              const childPalette =
                CHILD_COLOR_PALETTES[child.resolvedColorTheme];
              const childAccent = theme.isDark
                ? childPalette.darkAccent
                : childPalette.lightAccent;

              return (
                <View
                  key={child.id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.bgCard,
                      borderColor: isSelected
                        ? childPalette.swatch
                        : theme.border,
                    },
                    isSelected && styles.itemCardSelected,
                  ]}
                >
                  {isEditing ? (
                    <View>
                      <Text
                        style={[
                          styles.formCardTitle,
                          { color: theme.textPrimary },
                        ]}
                      >
                        ✏️ 「{child.name}」の登録情報を編集
                      </Text>
                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        お名前
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: theme.bgInput,
                            borderColor: theme.borderStrong,
                            color: theme.textPrimary,
                          },
                        ]}
                        value={editChildName}
                        onChangeText={setEditChildName}
                        placeholder="お名前を入力"
                        placeholderTextColor={theme.textMuted}
                      />

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        性別
                      </Text>
                      <View style={styles.optionRow}>
                        {(Object.values(Gender) as Gender[]).map((g) => {
                          const isGenderSelected = editChildGender === g;
                          return (
                            <TouchableOpacity
                              key={g}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor: theme.bgInput,
                                  borderColor: theme.borderStrong,
                                },
                                isGenderSelected && {
                                  backgroundColor: theme.primaryButtonBg,
                                  borderColor: theme.primaryButtonBg,
                                },
                              ]}
                              onPress={() => setEditChildGender(g)}
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  { color: theme.textSecondary },
                                  isGenderSelected &&
                                    styles.optionChipTextActive,
                                ]}
                              >
                                {GENDER_LABELS[g]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        生年月日 (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: theme.bgInput,
                            borderColor: theme.borderStrong,
                            color: theme.textPrimary,
                          },
                        ]}
                        value={editChildBirthDate}
                        onChangeText={setEditChildBirthDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.textMuted}
                      />

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        🎨 カラーテーマ
                      </Text>
                      <View style={styles.optionWrap}>
                        {CHILD_COLOR_THEME_LIST.map((palette) => {
                          const isColorSelected =
                            editChildColorTheme === palette.key;
                          return (
                            <TouchableOpacity
                              key={palette.key}
                              style={[
                                styles.colorThemeChip,
                                {
                                  backgroundColor: isColorSelected
                                    ? theme.isDark
                                      ? palette.darkSoftBg
                                      : palette.lightSoftBg
                                    : theme.bgInput,
                                  borderColor: isColorSelected
                                    ? palette.swatch
                                    : theme.borderStrong,
                                },
                              ]}
                              onPress={() =>
                                setEditChildColorTheme(palette.key)
                              }
                            >
                              <View
                                style={[
                                  styles.colorDot,
                                  { backgroundColor: palette.swatch },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.colorThemeChipText,
                                  {
                                    color: isColorSelected
                                      ? theme.isDark
                                        ? palette.darkAccent
                                        : palette.lightAccent
                                      : theme.textSecondary,
                                    fontWeight: isColorSelected ? '800' : '600',
                                  },
                                ]}
                              >
                                {palette.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.formActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.cancelButton,
                            {
                              backgroundColor: theme.bgCard,
                              borderColor: theme.dangerBorder,
                            },
                          ]}
                          onPress={() => setEditingChildId(null)}
                        >
                          <Text
                            style={[
                              styles.cancelButtonText,
                              { color: theme.dangerText },
                            ]}
                          >
                            キャンセル
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.saveButton,
                            { backgroundColor: theme.primaryButtonBg },
                          ]}
                          onPress={() => handleSaveEditChild(child)}
                        >
                          <Text style={styles.saveButtonText}>変更を保存</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardTitleGroup}>
                          <View
                            style={[
                              styles.colorDotLarge,
                              { backgroundColor: childPalette.swatch },
                            ]}
                          />
                          <Text
                            style={[
                              styles.itemName,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {child.gender === Gender.MALE
                              ? '👦'
                              : child.gender === Gender.FEMALE
                                ? '👧'
                                : '👶'}{' '}
                            {child.name}
                          </Text>
                          {isSelected ? (
                            <View
                              style={[
                                styles.activeBadge,
                                {
                                  backgroundColor: theme.isDark
                                    ? childPalette.darkSoftBg
                                    : childPalette.lightSoftBg,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.activeBadgeText,
                                  { color: childAccent },
                                ]}
                              >
                                表示中
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {!isSelected ? (
                          <TouchableOpacity
                            style={[
                              styles.switchButton,
                              {
                                backgroundColor: theme.bgElevated,
                                borderColor: theme.borderStrong,
                              },
                            ]}
                            onPress={() => {
                              onSelectChild(child.id);
                              showBanner(
                                `👶 表示対象を「${child.name}」に切り替えました`
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.switchButtonText,
                                { color: theme.textPrimary },
                              ]}
                            >
                              この子を表示
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={styles.metaGrid}>
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          性別: {GENDER_LABELS[child.gender] ?? child.gender}
                        </Text>
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          生年月日: {child.birthDate} (
                          {calculateAgeText(child.birthDate)})
                        </Text>
                      </View>

                      {/* クイックカラーテーマ選択行 */}
                      <View
                        style={[
                          styles.quickSettingBox,
                          {
                            backgroundColor: theme.bgElevated,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickSettingLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          🎨 カラーテーマ:
                        </Text>
                        <View style={styles.optionWrap}>
                          {CHILD_COLOR_THEME_LIST.map((palette) => {
                            const isThemeSelected =
                              child.resolvedColorTheme === palette.key;
                            return (
                              <TouchableOpacity
                                key={palette.key}
                                style={[
                                  styles.colorSwatchPill,
                                  {
                                    backgroundColor: isThemeSelected
                                      ? theme.isDark
                                        ? palette.darkSoftBg
                                        : palette.lightSoftBg
                                      : theme.bgCard,
                                    borderColor: isThemeSelected
                                      ? palette.swatch
                                      : theme.borderStrong,
                                  },
                                ]}
                                onPress={() =>
                                  handleQuickChangeChildColor(child, palette.key)
                                }
                              >
                                <View
                                  style={[
                                    styles.colorDot,
                                    { backgroundColor: palette.swatch },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.colorSwatchPillText,
                                    {
                                      color: isThemeSelected
                                        ? theme.isDark
                                          ? palette.darkAccent
                                          : palette.lightAccent
                                        : theme.textSecondary,
                                      fontWeight: isThemeSelected
                                        ? '800'
                                        : '600',
                                    },
                                  ]}
                                >
                                  {palette.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {isConfirmingDelete ? (
                        <View
                          style={[
                            styles.deleteConfirmBox,
                            {
                              backgroundColor: theme.dangerSoftBg,
                              borderColor: theme.dangerBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.deleteConfirmText,
                              { color: theme.dangerText },
                            ]}
                          >
                            ⚠️ 「{child.name}」と紐づく記録を削除しますか？
                          </Text>
                          <View style={styles.formActionRow}>
                            <TouchableOpacity
                              style={[
                                styles.cancelButton,
                                {
                                  backgroundColor: theme.bgCard,
                                  borderColor: theme.dangerBorder,
                                },
                              ]}
                              onPress={() => setConfirmDeleteChildId(null)}
                            >
                              <Text
                                style={[
                                  styles.cancelButtonText,
                                  { color: theme.dangerText },
                                ]}
                              >
                                キャンセル
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.dangerButton,
                                {
                                  backgroundColor: theme.dangerSoftBg,
                                  borderColor: theme.dangerText,
                                },
                              ]}
                              onPress={() => handleConfirmDeleteChild(child)}
                            >
                              <Text
                                style={[
                                  styles.dangerButtonText,
                                  { color: theme.dangerText },
                                ]}
                              >
                                削除を確定する
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.cardFooterRow,
                            { borderTopColor: theme.border },
                          ]}
                        >
                          <TouchableOpacity
                            style={[
                              styles.editOutlineButton,
                              {
                                backgroundColor: theme.bgElevated,
                                borderColor: theme.borderStrong,
                              },
                            ]}
                            onPress={() => handleStartEditChild(child)}
                          >
                            <Text
                              style={[
                                styles.editOutlineButtonText,
                                { color: theme.textPrimary },
                              ]}
                            >
                              ✏️ 編集
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.deleteOutlineButton,
                              {
                                backgroundColor: theme.dangerSoftBg,
                                borderColor: theme.dangerBorder,
                              },
                            ]}
                            onPress={() => setConfirmDeleteChildId(child.id)}
                          >
                            <Text
                              style={[
                                styles.deleteOutlineButtonText,
                                { color: theme.dangerText },
                              ]}
                            >
                              🗑️ 削除
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                ユーザー（家族・関係者）情報
              </Text>
              <TouchableOpacity
                style={[
                  styles.addPrimaryButton,
                  isAddingUser
                    ? {
                        backgroundColor: theme.dangerSoftBg,
                        borderWidth: 1,
                        borderColor: theme.dangerBorder,
                      }
                    : { backgroundColor: theme.primaryButtonBg },
                ]}
                onPress={() => setIsAddingUser((prev) => !prev)}
              >
                <Text
                  style={[
                    styles.addPrimaryButtonText,
                    isAddingUser && { color: theme.dangerText },
                  ]}
                >
                  {isAddingUser ? '✕ キャンセル' : '＋ 家族・記録者を追加'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ユーザー新規登録フォーム */}
            {isAddingUser ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.primaryBorder,
                  },
                ]}
              >
                <Text style={[styles.formCardTitle, { color: theme.textPrimary }]}>
                  👤 新しい家族・関係者ユーザーの追加
                </Text>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  表示名
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.bgInput,
                      borderColor: theme.borderStrong,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={newUserName}
                  onChangeText={setNewUserName}
                  placeholder="例: パパ、おばあちゃん"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  子どもとの関係性
                </Text>
                <View style={styles.optionWrap}>
                  {(Object.values(RelationshipType) as RelationshipType[]).map(
                    (rel) => {
                      const isSelected = newUserRelationship === rel;
                      return (
                        <TouchableOpacity
                          key={rel}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: theme.bgInput,
                              borderColor: theme.borderStrong,
                            },
                            isSelected && {
                              backgroundColor: theme.primaryButtonBg,
                              borderColor: theme.primaryButtonBg,
                            },
                          ]}
                          onPress={() => setNewUserRelationship(rel)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              { color: theme.textSecondary },
                              isSelected && styles.optionChipTextActive,
                            ]}
                          >
                            {RELATIONSHIP_LABELS[rel]}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  権限ロール
                </Text>
                <View style={styles.optionWrap}>
                  {(Object.values(UserRole) as UserRole[]).map((r) => {
                    const isSelected = newUserRole === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor: theme.bgInput,
                            borderColor: theme.borderStrong,
                          },
                          isSelected && {
                            backgroundColor: theme.primaryButtonBg,
                            borderColor: theme.primaryButtonBg,
                          },
                        ]}
                        onPress={() => setNewUserRole(r)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            { color: theme.textSecondary },
                            isSelected && styles.optionChipTextActive,
                          ]}
                        >
                          {USER_ROLE_LABELS[r]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  🌓 画面表示モード（ライトモード / ダークモード）
                </Text>
                <View style={styles.optionRow}>
                  {([ThemeMode.LIGHT, ThemeMode.DARK] as ThemeMode[]).map(
                    (mode) => {
                      const isSelected = newUserThemeMode === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.optionChip,
                            {
                              backgroundColor: theme.bgInput,
                              borderColor: theme.borderStrong,
                            },
                            isSelected && {
                              backgroundColor: theme.primaryButtonBg,
                              borderColor: theme.primaryButtonBg,
                            },
                          ]}
                          onPress={() => setNewUserThemeMode(mode)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              { color: theme.textSecondary },
                              isSelected && styles.optionChipTextActive,
                            ]}
                          >
                            {mode === ThemeMode.DARK ? '🌙 ' : '☀️ '}
                            {THEME_MODE_LABELS[mode]}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      {
                        backgroundColor: theme.bgCard,
                        borderColor: theme.dangerBorder,
                      },
                    ]}
                    onPress={() => setIsAddingUser(false)}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        { color: theme.dangerText },
                      ]}
                    >
                      キャンセル
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: theme.primaryButtonBg },
                    ]}
                    onPress={handleCreateUser}
                  >
                    <Text style={styles.saveButtonText}>追加する</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* 登録ユーザー一覧・編集カード */}
            {usersList.map((user) => {
              const isCurrentRecorder = user.id === activeUserId;
              const isEditing = editingUserId === user.id;

              return (
                <View
                  key={user.id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.bgCard,
                      borderColor: isCurrentRecorder
                        ? theme.primary
                        : theme.border,
                    },
                    isCurrentRecorder && styles.itemCardSelected,
                  ]}
                >
                  {isEditing ? (
                    <View>
                      <Text
                        style={[
                          styles.formCardTitle,
                          { color: theme.textPrimary },
                        ]}
                      >
                        ✏️ ユーザー「{user.name}」の情報を編集
                      </Text>

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        表示名
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: theme.bgInput,
                            borderColor: theme.borderStrong,
                            color: theme.textPrimary,
                          },
                        ]}
                        value={editUserName}
                        onChangeText={setEditUserName}
                        placeholder="表示名を入力"
                        placeholderTextColor={theme.textMuted}
                      />

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        子どもとの関係性
                      </Text>
                      <View style={styles.optionWrap}>
                        {(
                          Object.values(RelationshipType) as RelationshipType[]
                        ).map((rel) => {
                          const isSelected = editUserRelationship === rel;
                          return (
                            <TouchableOpacity
                              key={rel}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor: theme.bgInput,
                                  borderColor: theme.borderStrong,
                                },
                                isSelected && {
                                  backgroundColor: theme.primaryButtonBg,
                                  borderColor: theme.primaryButtonBg,
                                },
                              ]}
                              onPress={() => setEditUserRelationship(rel)}
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  { color: theme.textSecondary },
                                  isSelected && styles.optionChipTextActive,
                                ]}
                              >
                                {RELATIONSHIP_LABELS[rel]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        権限ロール
                      </Text>
                      <View style={styles.optionWrap}>
                        {(Object.values(UserRole) as UserRole[]).map((r) => {
                          const isSelected = editUserRole === r;
                          return (
                            <TouchableOpacity
                              key={r}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor: theme.bgInput,
                                  borderColor: theme.borderStrong,
                                },
                                isSelected && {
                                  backgroundColor: theme.primaryButtonBg,
                                  borderColor: theme.primaryButtonBg,
                                },
                              ]}
                              onPress={() => setEditUserRole(r)}
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  { color: theme.textSecondary },
                                  isSelected && styles.optionChipTextActive,
                                ]}
                              >
                                {USER_ROLE_LABELS[r]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text
                        style={[
                          styles.inputLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        🌓 画面表示モード（ライトモード / ダークモード）
                      </Text>
                      <View style={styles.optionRow}>
                        {([ThemeMode.LIGHT, ThemeMode.DARK] as ThemeMode[]).map(
                          (mode) => {
                            const isSelected = editUserThemeMode === mode;
                            return (
                              <TouchableOpacity
                                key={mode}
                                style={[
                                  styles.optionChip,
                                  {
                                    backgroundColor: theme.bgInput,
                                    borderColor: theme.borderStrong,
                                  },
                                  isSelected && {
                                    backgroundColor: theme.primaryButtonBg,
                                    borderColor: theme.primaryButtonBg,
                                  },
                                ]}
                                onPress={() => setEditUserThemeMode(mode)}
                              >
                                <Text
                                  style={[
                                    styles.optionChipText,
                                    { color: theme.textSecondary },
                                    isSelected && styles.optionChipTextActive,
                                  ]}
                                >
                                  {mode === ThemeMode.DARK ? '🌙 ' : '☀️ '}
                                  {THEME_MODE_LABELS[mode]}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>

                      <View style={styles.formActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.cancelButton,
                            {
                              backgroundColor: theme.bgCard,
                              borderColor: theme.dangerBorder,
                            },
                          ]}
                          onPress={() => setEditingUserId(null)}
                        >
                          <Text
                            style={[
                              styles.cancelButtonText,
                              { color: theme.dangerText },
                            ]}
                          >
                            キャンセル
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.saveButton,
                            { backgroundColor: theme.primaryButtonBg },
                          ]}
                          onPress={() => handleSaveEditUser(user)}
                        >
                          <Text style={styles.saveButtonText}>変更を保存</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardTitleGroup}>
                          <Text
                            style={[
                              styles.itemName,
                              { color: theme.textPrimary },
                            ]}
                          >
                            👤 {user.name}
                          </Text>
                          {isCurrentRecorder ? (
                            <View
                              style={[
                                styles.activeBadge,
                                { backgroundColor: theme.primarySoftBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.activeBadgeText,
                                  { color: theme.primary },
                                ]}
                              >
                                現在の記録者
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {!isCurrentRecorder ? (
                          <TouchableOpacity
                            style={[
                              styles.switchButton,
                              {
                                backgroundColor: theme.bgElevated,
                                borderColor: theme.borderStrong,
                              },
                            ]}
                            onPress={() => {
                              onSelectUser(user.id);
                              showBanner(
                                `👤 現在の記録者を「${user.name}」に切り替えました`
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.switchButtonText,
                                { color: theme.textPrimary },
                              ]}
                            >
                              記録者に設定
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <View style={styles.metaGrid}>
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          関係性:{' '}
                          {RELATIONSHIP_LABELS[user.relationship] ??
                            user.relationship}
                        </Text>
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          権限: {USER_ROLE_LABELS[user.role] ?? user.role}
                        </Text>
                      </View>

                      {/* クイック ライトモード・ダークモード切替行 */}
                      <View
                        style={[
                          styles.quickSettingBox,
                          {
                            backgroundColor: theme.bgElevated,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickSettingLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          🌓 表示モード設定:
                        </Text>
                        <View style={styles.optionRow}>
                          {(
                            [ThemeMode.LIGHT, ThemeMode.DARK] as ThemeMode[]
                          ).map((mode) => {
                            const isModeSelected =
                              user.resolvedThemeMode === mode;
                            return (
                              <TouchableOpacity
                                key={mode}
                                style={[
                                  styles.colorSwatchPill,
                                  {
                                    backgroundColor: isModeSelected
                                      ? theme.primaryButtonBg
                                      : theme.bgCard,
                                    borderColor: isModeSelected
                                      ? theme.primaryButtonBg
                                      : theme.borderStrong,
                                  },
                                ]}
                                onPress={() =>
                                  handleQuickChangeUserThemeMode(user, mode)
                                }
                              >
                                <Text
                                  style={[
                                    styles.colorSwatchPillText,
                                    {
                                      color: isModeSelected
                                        ? '#FFFFFF'
                                        : theme.textSecondary,
                                      fontWeight: isModeSelected
                                        ? '800'
                                        : '600',
                                    },
                                  ]}
                                >
                                  {mode === ThemeMode.DARK ? '🌙 ' : '☀️ '}
                                  {THEME_MODE_LABELS[mode]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View
                        style={[
                          styles.cardFooterRow,
                          { borderTopColor: theme.border },
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.editOutlineButton,
                            {
                              backgroundColor: theme.bgElevated,
                              borderColor: theme.borderStrong,
                            },
                          ]}
                          onPress={() => handleStartEditUser(user)}
                        >
                          <Text
                            style={[
                              styles.editOutlineButtonText,
                              { color: theme.textPrimary },
                            ]}
                          >
                            ✏️ ユーザー情報を編集
                          </Text>
                        </TouchableOpacity>
                        {usersList.length > 1 ? (
                          <TouchableOpacity
                            style={[
                              styles.deleteOutlineButton,
                              {
                                backgroundColor: theme.dangerSoftBg,
                                borderColor: theme.dangerBorder,
                              },
                            ]}
                            onPress={() => handleDeleteUser(user)}
                          >
                            <Text
                              style={[
                                styles.deleteOutlineButtonText,
                                { color: theme.dangerText },
                              ]}
                            >
                              🗑️ 削除
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export const SettingsScreen = withObservables([], () => ({
  childrenList: collections.children
    .query()
    .observeWithColumns(['name', 'gender', 'birth_date', 'color_theme']),
  usersList: collections.users
    .query()
    .observeWithColumns(['name', 'relationship', 'role', 'theme_mode']),
}))(RawSettingsScreen);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  screenTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  feedbackBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  addPrimaryButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  addPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  formCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  colorThemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorThemeChipText: {
    fontSize: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  quickSettingBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  quickSettingLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  colorSwatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  colorSwatchPillText: {
    fontSize: 11,
  },
  formActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dangerButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCardSelected: {
    borderWidth: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  switchButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  metaGrid: {
    marginTop: 8,
    gap: 3,
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
  },
  cardFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editOutlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  editOutlineButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  deleteOutlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteOutlineButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  deleteConfirmBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
});

export default SettingsScreen;
