import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { of as of$ } from 'rxjs';

import { Record as RecordModel, User } from '../db';
import { RECORD_CATEGORY_CONFIGS, RecordCategory } from '../types';
import { useAppTheme } from '../theme';

export interface RecordTimelineItemExternalProps {
  record: RecordModel;
  onDelete?: (record: RecordModel) => void;
  onPress?: (record: RecordModel) => void;
}

interface RecordTimelineItemInjectedProps extends RecordTimelineItemExternalProps {
  recorder: User | null;
}

function formatTime(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatExcretionLabel(type?: 'pee' | 'poop' | 'both'): string | null {
  switch (type) {
    case 'pee':
      return 'おしっこ';
    case 'poop':
      return 'うんち';
    case 'both':
      return 'おしっこ + うんち';
    default:
      return null;
  }
}

const RawRecordTimelineItem: React.FC<RecordTimelineItemInjectedProps> = ({
  record,
  recorder,
  onDelete,
  onPress,
}) => {
  const theme = useAppTheme();
  const config =
    RECORD_CATEGORY_CONFIGS[record.category] ??
    RECORD_CATEGORY_CONFIGS[RecordCategory.CUSTOM];
  const meta = record.parsedMetadata;
  const unit = meta.unit ?? config.defaultUnit ?? '';
  const durationMinutes = record.durationMinutes;
  const isSynced = record.syncStatus === 'synced';
  const excretionLabel = formatExcretionLabel(meta.excretion_type);
  const showItemName =
    (record.category === RecordCategory.MILK ||
      record.category === RecordCategory.BABY_FOOD ||
      record.category === RecordCategory.MEAL) &&
    Boolean(meta.item_name);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.bgCard,
          borderWidth: 1,
          borderColor: theme.border,
          borderLeftWidth: 4,
          borderLeftColor: theme.primary,
        },
      ]}
      activeOpacity={onPress ? 0.75 : 1}
      onPress={() => onPress?.(record)}
    >
      {/* 左側：時刻・タイムラインインジケータ */}
      <View
        style={[
          styles.timeColumn,
          { borderRightColor: theme.border },
        ]}
      >
        <Text style={[styles.startTimeText, { color: theme.textPrimary }]}>
          {formatTime(record.startTime)}
        </Text>
        {record.endTime ? (
          <Text style={[styles.endTimeText, { color: theme.textMuted }]}>
            〜{formatTime(record.endTime)}
          </Text>
        ) : null}
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: config.accentColor },
          ]}
        />
      </View>

      {/* 中央：カテゴリ・詳細情報 */}
      <View style={styles.contentColumn}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: theme.isDark
                  ? `${config.accentColor}38`
                  : `${config.accentColor}24`,
                borderWidth: 1,
                borderColor: `${config.accentColor}88`,
              },
            ]}
          >
            <Text style={styles.categoryIcon}>{config.icon}</Text>
            <Text
              style={[
                styles.categoryLabel,
                {
                  color: theme.isDark ? '#F8FAFC' : '#1E293B',
                },
              ]}
            >
              {config.label}
            </Text>
          </View>

          {meta.is_auto_recorded ? (
            <View
              style={[
                styles.autoBadge,
                {
                  backgroundColor: theme.isDark ? '#312E81' : '#EEF2FF',
                },
              ]}
            >
              <Text
                style={[
                  styles.autoBadgeText,
                  { color: theme.isDark ? '#C7D2FE' : '#4F46E5' },
                ]}
              >
                AI自動記録
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.syncBadge,
              isSynced
                ? {
                    backgroundColor: theme.isDark ? '#064E3B' : '#ECFDF5',
                  }
                : {
                    backgroundColor: theme.isDark ? '#451A03' : '#FFFBEB',
                  },
            ]}
          >
            <Text
              style={[
                styles.syncBadgeText,
                isSynced
                  ? { color: theme.isDark ? '#6EE7B7' : '#059669' }
                  : { color: theme.isDark ? '#FCD34D' : '#D97706' },
              ]}
            >
              {isSynced ? '同期済' : 'ローカル保存'}
            </Text>
          </View>
        </View>

        {/* 数量・所要時間・品名 */}
        <View style={styles.detailsRow}>
          {record.amount !== null && record.amount !== undefined ? (
            <Text style={[styles.amountText, { color: theme.textPrimary }]}>
              {record.amount}
              <Text style={[styles.unitText, { color: theme.textSecondary }]}>
                {' '}
                {unit}
              </Text>
            </Text>
          ) : null}

          {durationMinutes !== null ? (
            <Text style={[styles.durationText, { color: theme.textSecondary }]}>
              {durationMinutes}分間
            </Text>
          ) : null}

          {showItemName ? (
            <Text
              style={[
                styles.itemNameText,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.bgElevated,
                },
              ]}
            >
              {meta.item_name}
            </Text>
          ) : null}

          {excretionLabel ? (
            <Text
              style={[
                styles.itemNameText,
                {
                  color: theme.textPrimary,
                  backgroundColor: theme.bgElevated,
                },
              ]}
            >
              {excretionLabel}
            </Text>
          ) : null}
        </View>

        {meta.note ? (
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>
            {meta.note}
          </Text>
        ) : null}

        <View
          style={[
            styles.footerRow,
            { borderTopColor: theme.border },
          ]}
        >
          <Text style={[styles.recorderText, { color: theme.textMuted }]}>
            記録者: {recorder ? recorder.name : '未指定'}
          </Text>
          <View style={styles.footerActions}>
            {onPress ? (
              <TouchableOpacity
                onPress={() => onPress(record)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[styles.editButtonText, { color: theme.primary }]}
                >
                  ✏️ 編集
                </Text>
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                onPress={() => onDelete(record)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.deleteButtonText,
                    { color: theme.dangerText },
                  ]}
                >
                  削除
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * `withObservables` によって当該レコードおよび紐づく記録者(User)の変更をリアクティブに購読する
 */
export const RecordTimelineItem = withObservables(
  ['record'],
  ({ record }: RecordTimelineItemExternalProps) => ({
    record: record.observe(),
    recorder: record.recordedBy ? record.recorder.observe() : of$(null),
  })
)(RawRecordTimelineItem);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  timeColumn: {
    width: 64,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 10,
    marginRight: 12,
  },
  startTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  endTimeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  contentColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  autoBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F46E5',
  },
  syncBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  syncedBadge: {
    backgroundColor: '#ECFDF5',
  },
  unsyncedBadge: {
    backgroundColor: '#FFFBEB',
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  syncedText: {
    color: '#059669',
  },
  unsyncedText: {
    color: '#D97706',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 2,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  noteText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  recorderText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  editButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
});

export default RecordTimelineItem;
