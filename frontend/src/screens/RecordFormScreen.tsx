import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Record as RecordModel } from '../db';
import {
  RECORD_CATEGORY_CONFIGS,
  RecordCategory,
  RecordMetadata,
} from '../types';
import {
  createRecordOffline,
  syncDatabase,
  updateRecordOffline,
} from '../services';
import { useAppTheme } from '../theme';

export interface RecordFormScreenProps {
  childId: string;
  recordedBy?: string | null;
  initialCategory?: RecordCategory;
  editingRecord?: RecordModel | null;
  onSaved: () => void;
  onCancel: () => void;
}

const CATEGORIES = Object.values(RECORD_CATEGORY_CONFIGS);

/**
 * 要件定義書記載の家庭内ルール・よく使うプリセット
 */
const QUICK_PRESETS: Array<{
  label: string;
  category: RecordCategory;
  amount?: number;
  unit?: string;
  itemName?: string;
}> = [
  {
    label: '🍼 ミルク 160ml',
    category: RecordCategory.MILK,
    amount: 160,
    unit: 'ml',
  },
  {
    label: '🍼 ミルク 200ml',
    category: RecordCategory.MILK,
    amount: 200,
    unit: 'ml',
  },
  {
    label: '🥣 和光堂ラタトゥイユ (100g)',
    category: RecordCategory.BABY_FOOD,
    amount: 100,
    unit: 'g',
    itemName: '和光堂ラタトゥイユ',
  },
  {
    label: '🌡️ 体温 36.6℃',
    category: RecordCategory.BODY_TEMP,
    amount: 36.6,
    unit: '℃',
  },
  {
    label: '📏 身長 71.0cm',
    category: RecordCategory.HEIGHT,
    amount: 71.0,
    unit: 'cm',
  },
  {
    label: '⚖️ 体重 8.8kg',
    category: RecordCategory.WEIGHT,
    amount: 8.8,
    unit: 'kg',
  },
];

function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTimeHm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export const RecordFormScreen: React.FC<RecordFormScreenProps> = ({
  childId,
  recordedBy,
  initialCategory = RecordCategory.MILK,
  editingRecord = null,
  onSaved,
  onCancel,
}) => {
  const isEditMode = Boolean(editingRecord);
  const existingMeta = editingRecord ? editingRecord.parsedMetadata : {};
  const resolvedInitialCategory = editingRecord
    ? editingRecord.category
    : initialCategory;
  const initialConfig =
    RECORD_CATEGORY_CONFIGS[resolvedInitialCategory] ??
    RECORD_CATEGORY_CONFIGS[RecordCategory.CUSTOM];
  const baseStartTime = editingRecord ? editingRecord.startTime : new Date();

  const [category, setCategory] = useState<RecordCategory>(
    resolvedInitialCategory
  );
  const [amountInput, setAmountInput] = useState<string>(
    editingRecord &&
      editingRecord.amount !== null &&
      editingRecord.amount !== undefined
      ? String(editingRecord.amount)
      : ''
  );
  const [unit, setUnit] = useState<string>(
    existingMeta.unit ?? initialConfig.defaultUnit ?? ''
  );
  const [itemName, setItemName] = useState<string>(
    existingMeta.item_name ?? ''
  );
  const [note, setNote] = useState<string>(existingMeta.note ?? '');
  const [excretionType, setExcretionType] = useState<'pee' | 'poop' | 'both'>(
    existingMeta.excretion_type ?? 'pee'
  );
  const [startOffsetMinutes, setStartOffsetMinutes] = useState<number | null>(
    editingRecord ? null : 0
  );
  const [customDateInput, setCustomDateInput] = useState<string>(
    formatDateYmd(baseStartTime)
  );
  const [customTimeInput, setCustomTimeInput] = useState<string>(
    formatTimeHm(baseStartTime)
  );
  const [durationMinutesInput, setDurationMinutesInput] = useState<string>(
    editingRecord && editingRecord.durationMinutes !== null
      ? String(editingRecord.durationMinutes)
      : ''
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (editingRecord) {
      const meta = editingRecord.parsedMetadata;
      const cfg =
        RECORD_CATEGORY_CONFIGS[editingRecord.category] ??
        RECORD_CATEGORY_CONFIGS[RecordCategory.CUSTOM];
      setCategory(editingRecord.category);
      setAmountInput(
        editingRecord.amount !== null && editingRecord.amount !== undefined
          ? String(editingRecord.amount)
          : ''
      );
      setUnit(meta.unit ?? cfg.defaultUnit ?? '');
      setItemName(meta.item_name ?? '');
      setNote(meta.note ?? '');
      setExcretionType(meta.excretion_type ?? 'pee');
      setStartOffsetMinutes(null);
      setCustomDateInput(formatDateYmd(editingRecord.startTime));
      setCustomTimeInput(formatTimeHm(editingRecord.startTime));
      setDurationMinutesInput(
        editingRecord.durationMinutes !== null
          ? String(editingRecord.durationMinutes)
          : ''
      );
    }
  }, [editingRecord]);

  const activeConfig =
    RECORD_CATEGORY_CONFIGS[category] ??
    RECORD_CATEGORY_CONFIGS[RecordCategory.CUSTOM];
  const theme = useAppTheme();

  /**
   * 要件4: 「ミルク・授乳」「離乳食」「食事」のみメニュー・品名欄を表示する
   */
  const showItemNameField =
    category === RecordCategory.MILK ||
    category === RecordCategory.BABY_FOOD ||
    category === RecordCategory.MEAL;

  /**
   * 編集モード時に元のレコードから変更があるかを判定する
   */
  const hasChanges = useMemo<boolean>(() => {
    if (!editingRecord) {
      return true;
    }
    const origMeta = editingRecord.parsedMetadata;
    const origCfg =
      RECORD_CATEGORY_CONFIGS[editingRecord.category] ??
      RECORD_CATEGORY_CONFIGS[RecordCategory.CUSTOM];
    const origAmountStr =
      editingRecord.amount !== null && editingRecord.amount !== undefined
        ? String(editingRecord.amount)
        : '';
    const origUnitStr = (origMeta.unit ?? origCfg.defaultUnit ?? '').trim();
    const origItemNameStr = (origMeta.item_name ?? '').trim();
    const origNoteStr = (origMeta.note ?? '').trim();
    const origExcretionType = origMeta.excretion_type ?? 'pee';
    const origDateStr = formatDateYmd(editingRecord.startTime);
    const origTimeStr = formatTimeHm(editingRecord.startTime);
    const origDurationStr =
      editingRecord.durationMinutes !== null
        ? String(editingRecord.durationMinutes)
        : '';

    if (category !== editingRecord.category) return true;
    if (activeConfig.hasAmount) {
      if (amountInput.trim() !== origAmountStr) return true;
      if (unit.trim() !== origUnitStr) return true;
    }
    if (
      activeConfig.hasDuration &&
      durationMinutesInput.trim() !== origDurationStr
    ) {
      return true;
    }
    if (
      category === RecordCategory.EXCRETION &&
      excretionType !== origExcretionType
    ) {
      return true;
    }
    if (showItemNameField && itemName.trim() !== origItemNameStr) return true;
    if (note.trim() !== origNoteStr) return true;
    if (startOffsetMinutes !== null) return true;
    if (customDateInput.trim() !== origDateStr) return true;
    if (customTimeInput.trim() !== origTimeStr) return true;

    return false;
  }, [
    activeConfig.hasAmount,
    activeConfig.hasDuration,
    amountInput,
    category,
    customDateInput,
    customTimeInput,
    durationMinutesInput,
    editingRecord,
    excretionType,
    itemName,
    note,
    showItemNameField,
    startOffsetMinutes,
    unit,
  ]);

  const handleSelectCategory = useCallback((nextCategory: RecordCategory) => {
    setCategory(nextCategory);
    const nextCfg = RECORD_CATEGORY_CONFIGS[nextCategory];
    setUnit(nextCfg.defaultUnit ?? '');
  }, []);

  const handleApplyPreset = useCallback(
    (preset: (typeof QUICK_PRESETS)[number]) => {
      setCategory(preset.category);
      setAmountInput(preset.amount !== undefined ? String(preset.amount) : '');
      setUnit(
        preset.unit ??
          RECORD_CATEGORY_CONFIGS[preset.category].defaultUnit ??
          ''
      );
      if (preset.itemName) {
        setItemName(preset.itemName);
      }
    },
    []
  );

  const handleSelectOffset = useCallback((minutes: number | null) => {
    setStartOffsetMinutes(minutes);
    if (minutes !== null) {
      const target = new Date(Date.now() - minutes * 60 * 1000);
      setCustomDateInput(formatDateYmd(target));
      setCustomTimeInput(formatTimeHm(target));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving || (isEditMode && !hasChanges)) {
      return;
    }
    setIsSaving(true);

    try {
      let startTime: Date;
      if (startOffsetMinutes !== null) {
        startTime = new Date(Date.now() - startOffsetMinutes * 60 * 1000);
      } else if (
        editingRecord &&
        customDateInput.trim() === formatDateYmd(editingRecord.startTime) &&
        customTimeInput.trim() === formatTimeHm(editingRecord.startTime)
      ) {
        startTime = editingRecord.startTime;
      } else {
        const parsedCustom = new Date(
          `${customDateInput.trim()}T${customTimeInput.trim() || '09:00'}:00`
        );
        startTime = Number.isNaN(parsedCustom.getTime())
          ? new Date()
          : parsedCustom;
      }

      const parsedDuration = Number.parseFloat(durationMinutesInput);
      const endTime =
        activeConfig.hasDuration &&
        !Number.isNaN(parsedDuration) &&
        parsedDuration > 0
          ? new Date(startTime.getTime() + parsedDuration * 60 * 1000)
          : null;

      const parsedAmount = Number.parseFloat(amountInput);
      const amount =
        activeConfig.hasAmount && !Number.isNaN(parsedAmount)
          ? parsedAmount
          : null;

      const metadata: RecordMetadata = {
        is_auto_recorded: editingRecord
          ? editingRecord.parsedMetadata.is_auto_recorded ?? false
          : false,
        source: editingRecord
          ? editingRecord.parsedMetadata.source ?? 'manual'
          : 'manual',
      };
      if (activeConfig.hasAmount && unit.trim()) {
        metadata.unit = unit.trim();
      }
      if (showItemNameField && itemName.trim()) {
        metadata.item_name = itemName.trim();
      }
      if (note.trim()) {
        metadata.note = note.trim();
      }
      if (category === RecordCategory.EXCRETION) {
        metadata.excretion_type = excretionType;
      }

      if (editingRecord) {
        // 1. 既存レコードの更新（オフラインファースト）
        await updateRecordOffline(editingRecord, {
          recordedBy: recordedBy ?? editingRecord.recordedBy,
          category,
          startTime,
          endTime,
          amount,
          metadata,
        });
      } else {
        // 1. ローカルの WatermelonDB へ新規書き込み（オフラインファースト）
        await createRecordOffline({
          childId,
          recordedBy,
          category,
          startTime,
          endTime,
          amount,
          metadata,
        });
      }

      // 2. バックグラウンドで非同期に FastAPI への Push/Pull 同期を試行（UIはブロックしない）
      void syncDatabase({ childId });

      onSaved();
    } finally {
      setIsSaving(false);
    }
  }, [
    activeConfig.hasAmount,
    activeConfig.hasDuration,
    amountInput,
    category,
    childId,
    customDateInput,
    customTimeInput,
    durationMinutesInput,
    editingRecord,
    excretionType,
    hasChanges,
    isEditMode,
    isSaving,
    itemName,
    note,
    onSaved,
    recordedBy,
    showItemNameField,
    startOffsetMinutes,
    unit,
  ]);

  const isSubmitDisabled = isSaving || (isEditMode && !hasChanges);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bgScreen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ヘッダー */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bgCard,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.cancelText, { color: theme.dangerText }]}>
            キャンセル
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          {isEditMode ? '育児ログの編集' : '新規育児ログの記録'}
        </Text>
        <TouchableOpacity
          style={[
            styles.saveHeaderButton,
            { backgroundColor: theme.primaryButtonBg },
            isSubmitDisabled && styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={isSubmitDisabled}
        >
          <Text style={styles.saveHeaderButtonText}>
            {isEditMode
              ? isSaving
                ? '更新中...'
                : '更新'
              : isSaving
                ? '保存中...'
                : '保存'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ワンタップ家庭内ルールプリセット */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          ⚡ ワンタップ入力（家庭内ルール）
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {QUICK_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={[
                styles.presetChip,
                {
                  backgroundColor: theme.bgCard,
                  borderColor: theme.borderStrong,
                },
              ]}
              onPress={() => handleApplyPreset(preset)}
            >
              <Text
                style={[styles.presetChipText, { color: theme.textPrimary }]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* カテゴリ選択 */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          1. カテゴリを選択
        </Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cfg) => {
            const isSelected = cfg.category === category;
            return (
              <TouchableOpacity
                key={cfg.category}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.border,
                  },
                  isSelected && {
                    borderColor: theme.primary,
                    backgroundColor: theme.primarySoftBg,
                  },
                ]}
                onPress={() => handleSelectCategory(cfg.category)}
              >
                <Text style={styles.categoryIcon}>{cfg.icon}</Text>
                <Text
                  style={[
                    styles.categoryButtonText,
                    { color: theme.textSecondary },
                    isSelected && {
                      color: theme.primary,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 排泄種別（排泄カテゴリ選択時のみ表示） */}
        {category === RecordCategory.EXCRETION ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              2. 排泄の種類
            </Text>
            <View style={styles.segmentedRow}>
              {(
                [
                  { key: 'pee', label: '💧 おしっこ' },
                  { key: 'poop', label: '💩 うんち' },
                  { key: 'both', label: '✨ 両方' },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: theme.bgCard,
                      borderColor: theme.borderStrong,
                    },
                    excretionType === opt.key && {
                      backgroundColor: theme.primaryButtonBg,
                      borderColor: theme.primaryButtonBg,
                    },
                  ]}
                  onPress={() => setExcretionType(opt.key)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: theme.textSecondary },
                      excretionType === opt.key &&
                        styles.segmentButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* 数量・単位入力 */}
        {activeConfig.hasAmount ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              2. 数量・測定値
            </Text>
            <View style={styles.amountInputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.amountInput,
                  {
                    backgroundColor: theme.bgInput,
                    borderColor: theme.borderStrong,
                    color: theme.textPrimary,
                  },
                ]}
                value={amountInput}
                onChangeText={setAmountInput}
                placeholder={`例: ${
                  category === RecordCategory.BODY_TEMP
                    ? '36.6'
                    : category === RecordCategory.HEIGHT
                      ? '70.5'
                      : category === RecordCategory.WEIGHT
                        ? '8.5'
                        : '100'
                }`}
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[
                  styles.textInput,
                  styles.unitInput,
                  {
                    backgroundColor: theme.bgInput,
                    borderColor: theme.borderStrong,
                    color: theme.textPrimary,
                  },
                ]}
                value={unit}
                onChangeText={setUnit}
                placeholder="単位 (ml, g, ℃, cm, kg)"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
        ) : null}

        {/* 睡眠などの所要時間入力 */}
        {activeConfig.hasDuration ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              2. 継続時間（分）
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
              value={durationMinutesInput}
              onChangeText={setDurationMinutesInput}
              placeholder="例: 120 (未入力の場合は開始時刻のみ記録)"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
            />
          </View>
        ) : null}

        {/* 記録時刻オフセットまたは日時指定 */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            3. 記録日時（開始時刻）
          </Text>
          <View style={styles.segmentedRow}>
            {[
              { label: 'いま', minutes: 0 },
              { label: '15分前', minutes: 15 },
              { label: '30分前', minutes: 30 },
              { label: '1時間前', minutes: 60 },
              { label: '日時指定', minutes: null },
            ].map((item) => (
              <TouchableOpacity
                key={String(item.minutes)}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.borderStrong,
                  },
                  startOffsetMinutes === item.minutes && {
                    backgroundColor: theme.primaryButtonBg,
                    borderColor: theme.primaryButtonBg,
                  },
                ]}
                onPress={() => handleSelectOffset(item.minutes)}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    { color: theme.textSecondary },
                    startOffsetMinutes === item.minutes &&
                      styles.segmentButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {startOffsetMinutes === null ? (
            <View style={[styles.amountInputRow, { marginTop: 8 }]}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    flex: 1.4,
                    backgroundColor: theme.bgInput,
                    borderColor: theme.borderStrong,
                    color: theme.textPrimary,
                  },
                ]}
                value={customDateInput}
                onChangeText={setCustomDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
              />
              <TextInput
                style={[
                  styles.textInput,
                  {
                    flex: 1,
                    backgroundColor: theme.bgInput,
                    borderColor: theme.borderStrong,
                    color: theme.textPrimary,
                  },
                ]}
                value={customTimeInput}
                onChangeText={setCustomTimeInput}
                placeholder="HH:MM (例: 09:30)"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          ) : null}
        </View>

        {/* 要件4: 「ミルク・授乳」「離乳食」「食事」のみメニュー・品名欄を表示 */}
        {showItemNameField ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              4. メニュー・品名 (metadata.item_name)
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
              value={itemName}
              onChangeText={setItemName}
              placeholder="例: 和光堂ラタトゥイユ、野菜スープ"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            {showItemNameField
              ? '5. ひとことメモ (metadata.note)'
              : '4. ひとことメモ (metadata.note)'}
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.multilineInput,
              {
                backgroundColor: theme.bgInput,
                borderColor: theme.borderStrong,
                color: theme.textPrimary,
              },
            ]}
            value={note}
            onChangeText={setNote}
            placeholder="機嫌や食べっぷりなど自由に入力"
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 編集モード時の変更ステータス表示 */}
        {isEditMode ? (
          <View
            style={[
              styles.changeStatusBanner,
              hasChanges
                ? {
                    backgroundColor: theme.primarySoftBg,
                    borderColor: theme.primaryBorder,
                  }
                : {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.border,
                  },
            ]}
          >
            <Text
              style={[
                styles.changeStatusText,
                {
                  color: hasChanges ? theme.primary : theme.textMuted,
                },
              ]}
            >
              {hasChanges
                ? '✨ 内容が変更されています。「更新」ボタンで記録を更新できます。'
                : '✏️ 項目を編集すると「更新」ボタンから記録を更新できます。'}
            </Text>
          </View>
        ) : null}

        {/* メイン保存・更新ボタン */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.primaryButtonBg },
            isSubmitDisabled && styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={isSubmitDisabled}
        >
          <Text style={styles.submitButtonText}>
            {isEditMode
              ? isSaving
                ? 'ローカルDBを更新中...'
                : `${activeConfig.icon} ${activeConfig.label}の記録を更新する`
              : isSaving
                ? 'ローカルDBに書き込み中...'
                : `${activeConfig.icon} ${activeConfig.label}の記録を保存する`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancelText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  saveHeaderButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  saveHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 12,
  },
  presetRow: {
    gap: 8,
    paddingBottom: 4,
  },
  presetChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  fieldGroup: {
    marginTop: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  amountInput: {
    flex: 2,
    fontSize: 18,
    fontWeight: '700',
  },
  unitInput: {
    flex: 1,
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  changeStatusBanner: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeStatusBannerIdle: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  changeStatusBannerActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  changeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  changeStatusTextIdle: {
    color: '#64748B',
  },
  changeStatusTextActive: {
    color: '#1D4ED8',
  },
});

export default RecordFormScreen;
