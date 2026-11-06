import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';

import {
  CameraEvent,
  Child,
  collections,
  Record as RecordModel,
} from '../db';
import { RecordCategory } from '../types';
import { deleteRecordOffline, syncDatabase } from '../services';
import { CategoryFilterBar, RecordTimelineItem } from '../components';
import { useAppTheme } from '../theme';

export interface RecordTimelineListExternalProps {
  childId: string;
  selectedCategory: RecordCategory | null;
  onSelectRecord?: (record: RecordModel) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

interface RecordTimelineListInjectedProps
  extends RecordTimelineListExternalProps {
  child: Child;
  records: RecordModel[];
  recentCameraEvents: CameraEvent[];
}

const RawRecordTimelineList: React.FC<RecordTimelineListInjectedProps> = ({
  child,
  records,
  recentCameraEvents,
  onSelectRecord,
  refreshing,
  onRefresh,
}) => {
  const theme = useAppTheme();

  const handleDelete = useCallback(async (record: RecordModel) => {
    await deleteRecordOffline(record);
  }, []);

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View
            style={[
              styles.summaryRow,
              {
                backgroundColor: theme.primarySoftBg,
                borderColor: theme.primaryBorder,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
            ]}
          >
            <Text style={[styles.summaryText, { color: theme.primary }]}>
              {theme.palette.icon} {child.name} の記録 ({records.length}件)
            </Text>
            <Text style={[styles.birthDateText, { color: theme.textSecondary }]}>
              生年月日: {child.birthDate}
            </Text>
          </View>

          {recentCameraEvents.length > 0 ? (
            <View
              style={[
                styles.cameraBanner,
                {
                  backgroundColor: theme.primarySoftBg,
                  borderColor: theme.primaryBorder,
                },
              ]}
            >
              <Text
                style={[styles.cameraBannerTitle, { color: theme.primary }]}
              >
                📷 スマートカメラ検知ログ (最新{recentCameraEvents.length}件)
              </Text>
              {recentCameraEvents.map((evt) => (
                <Text
                  key={evt.id}
                  style={[
                    styles.cameraEventText,
                    { color: theme.textSecondary },
                  ]}
                >
                  ・{evt.eventType} (信頼度: {Math.round(evt.confidence * 100)}%)
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <RecordTimelineItem
          record={item}
          onPress={onSelectRecord}
          onDelete={handleDelete}
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📒</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            まだ記録がありません
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            右下の「＋ 記録を追加」ボタンからオフラインでも即座に記録できます。
          </Text>
        </View>
      }
    />
  );
};

/**
 * WatermelonDB の `withObservables` で `records` テーブルのクエリをリアクティブに監視する。
 * `observeWithColumns` を用いることで、レコードの追加・削除だけでなく
 * 既存レコードの数量や metadata(JSON文字列) の変更時も即座にUIが再描画される。
 */
const ObservedRecordTimelineList = withObservables(
  ['childId', 'selectedCategory'],
  ({ childId, selectedCategory }: RecordTimelineListExternalProps) => {
    const queryConditions: Q.Clause[] = [Q.where('child_id', childId)];
    if (selectedCategory) {
      queryConditions.push(Q.where('category', selectedCategory));
    }
    queryConditions.push(Q.sortBy('start_time', Q.desc));

    return {
      child: collections.children.findAndObserve(childId),
      records: collections.records
        .query(...queryConditions)
        .observeWithColumns([
          'category',
          'start_time',
          'end_time',
          'amount',
          'metadata',
          'recorded_by',
        ]),
      recentCameraEvents: collections.cameraEvents
        .query(
          Q.where('child_id', childId),
          Q.sortBy('detected_at', Q.desc),
          Q.take(3)
        )
        .observe(),
    };
  }
)(RawRecordTimelineList);

export interface RecordTimelineScreenProps {
  childId: string;
  onOpenCreateModal: (defaultCategory?: RecordCategory) => void;
  onEditRecord?: (record: RecordModel) => void;
}

export const RecordTimelineScreen: React.FC<RecordTimelineScreenProps> = ({
  childId,
  onOpenCreateModal,
  onEditRecord,
}) => {
  const theme = useAppTheme();
  const [selectedCategory, setSelectedCategory] =
    useState<RecordCategory | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    await syncDatabase({
      childId,
      onSyncStart: () => {
        setIsSyncing(true);
        setSyncErrorMessage(null);
      },
      onSyncSuccess: (syncedAt) => {
        setLastSyncedAt(syncedAt);
        setIsSyncing(false);
      },
      onSyncError: () => {
        setSyncErrorMessage('オフライン動作中（オンライン復帰時に自動同期）');
        setIsSyncing(false);
      },
    });
  }, [childId]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgScreen }]}>
      {/* サブバー：画面見出しとクラウド同期ステータス */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.bgCard,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.appTitle, { color: theme.textPrimary }]}>
            📒 育児ログタイムライン
          </Text>
          <Text style={[styles.syncStatusSubtext, { color: theme.textMuted }]}>
            {syncErrorMessage
              ? syncErrorMessage
              : lastSyncedAt
                ? `最終同期: ${lastSyncedAt.toLocaleTimeString()}`
                : 'オフラインファースト・ローカルDB稼働中（カードをタップして編集）'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.syncButton,
            { backgroundColor: theme.primaryButtonBg },
          ]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.syncButtonText}>🔄 同期</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* カテゴリフィルタバー */}
      <CategoryFilterBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* WatermelonDB 監視タイムラインリスト */}
      <ObservedRecordTimelineList
        childId={childId}
        selectedCategory={selectedCategory}
        onSelectRecord={onEditRecord}
        refreshing={isSyncing}
        onRefresh={handleSync}
      />

      {/* フローティング新規記録ボタン */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primaryButtonBg }]}
        activeOpacity={0.85}
        onPress={() => onOpenCreateModal(selectedCategory ?? undefined)}
      >
        <Text style={styles.fabText}>＋ 記録を追加</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  syncStatusSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 76,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  listHeader: {
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  birthDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  cameraBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  cameraBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 4,
  },
  cameraEventText: {
    fontSize: 12,
    color: '#4338CA',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default RecordTimelineScreen;
