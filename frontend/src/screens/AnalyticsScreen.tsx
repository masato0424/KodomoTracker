import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';

import { Child, collections, Record as RecordModel } from '../db';
import {
  Gender,
  GENDER_LABELS,
  RECORD_CATEGORY_CONFIGS,
  RecordCategory,
  UserRole,
} from '../types';
import { seedSampleAnalyticsRecords } from '../services';
import { useAppTheme } from '../theme';

export type AnalyticsSubTab =
  | 'growth'
  | 'meal_excretion'
  | 'sleep'
  | 'temperature';

export type GrowthMetricCategory =
  | typeof RecordCategory.HEIGHT
  | typeof RecordCategory.WEIGHT
  | typeof RecordCategory.HEAD_CIRCUMFERENCE
  | typeof RecordCategory.CHEST_CIRCUMFERENCE
  | typeof RecordCategory.FOOT_SIZE;

/** 要件定義 FR-05 準拠: 月齢換算除数 30.4375 日 */
export const AGE_MONTH_DIVISOR_DAYS = 30.4375;
export const AGE_MONTH_DIVISOR_MS = AGE_MONTH_DIVISOR_DAYS * 24 * 60 * 60 * 1000;

export function calculateAgeInMonths(birthDate: Date, targetDate: Date): number {
  const birthMs = birthDate.getTime();
  const targetMs = targetDate.getTime();
  if (Number.isNaN(birthMs) || Number.isNaN(targetMs)) {
    return 0;
  }
  return Math.max(0, (targetMs - birthMs) / AGE_MONTH_DIVISOR_MS);
}

export function formatMinutesToHoursMinutes(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}時間${mins}分`;
}

export interface PercentilePoint {
  month: number;
  p3: number;
  p50: number;
  p97: number;
}

export interface GrowthMetricConfig {
  category: GrowthMetricCategory;
  label: string;
  icon: string;
  unit: string;
  color: string;
  minY: number;
  maxY: number;
  /** 性別ごとのパーセンタイル基準点 (0ヶ月〜216ヶ月: 学童期・思春期まで対応) */
  percentilesByGender: {
    male: PercentilePoint[];
    female: PercentilePoint[];
    unspecified: PercentilePoint[];
  };
}

function buildAveragedPercentiles(
  male: PercentilePoint[],
  female: PercentilePoint[]
): PercentilePoint[] {
  return male.map((m, idx) => {
    const f = female[idx] ?? m;
    return {
      month: m.month,
      p3: Number(((m.p3 + f.p3) / 2).toFixed(2)),
      p50: Number(((m.p50 + f.p50) / 2).toFixed(2)),
      p97: Number(((m.p97 + f.p97) / 2).toFixed(2)),
    };
  });
}

const HEIGHT_MALE: PercentilePoint[] = [
  { month: 0, p3: 46.3, p50: 49.9, p97: 53.4 },
  { month: 3, p3: 57.6, p50: 61.4, p97: 65.3 },
  { month: 6, p3: 63.6, p50: 67.6, p97: 71.6 },
  { month: 9, p3: 67.7, p50: 72.0, p97: 76.2 },
  { month: 12, p3: 71.0, p50: 75.7, p97: 80.5 },
  { month: 24, p3: 81.7, p50: 87.8, p97: 93.9 },
  { month: 36, p3: 88.7, p50: 96.1, p97: 103.5 },
  { month: 60, p3: 100.7, p50: 110.0, p97: 119.2 },
  { month: 120, p3: 127.0, p50: 138.6, p97: 150.5 },
  { month: 216, p3: 159.5, p50: 170.8, p97: 182.2 },
];
const HEIGHT_FEMALE: PercentilePoint[] = [
  { month: 0, p3: 45.6, p50: 49.1, p97: 52.7 },
  { month: 3, p3: 55.8, p50: 59.8, p97: 63.8 },
  { month: 6, p3: 61.5, p50: 65.7, p97: 70.0 },
  { month: 9, p3: 65.6, p50: 70.1, p97: 74.7 },
  { month: 12, p3: 69.2, p50: 74.0, p97: 78.9 },
  { month: 24, p3: 80.0, p50: 86.4, p97: 92.9 },
  { month: 36, p3: 87.4, p50: 95.1, p97: 102.7 },
  { month: 60, p3: 99.9, p50: 109.4, p97: 118.9 },
  { month: 120, p3: 126.8, p50: 138.4, p97: 150.2 },
  { month: 216, p3: 148.2, p50: 158.1, p97: 168.0 },
];

const WEIGHT_MALE: PercentilePoint[] = [
  { month: 0, p3: 2.5, p50: 3.3, p97: 4.3 },
  { month: 3, p3: 5.1, p50: 6.4, p97: 7.9 },
  { month: 6, p3: 6.4, p50: 7.9, p97: 9.7 },
  { month: 9, p3: 7.2, p50: 8.9, p97: 10.9 },
  { month: 12, p3: 7.8, p50: 9.6, p97: 11.8 },
  { month: 24, p3: 9.7, p50: 12.2, p97: 15.3 },
  { month: 36, p3: 11.3, p50: 14.3, p97: 18.3 },
  { month: 60, p3: 14.1, p50: 18.3, p97: 24.2 },
  { month: 120, p3: 24.0, p50: 33.0, p97: 46.5 },
  { month: 216, p3: 48.0, p50: 62.5, p97: 82.0 },
];
const WEIGHT_FEMALE: PercentilePoint[] = [
  { month: 0, p3: 2.4, p50: 3.2, p97: 4.2 },
  { month: 3, p3: 4.6, p50: 5.8, p97: 7.4 },
  { month: 6, p3: 5.8, p50: 7.3, p97: 9.2 },
  { month: 9, p3: 6.6, p50: 8.2, p97: 10.4 },
  { month: 12, p3: 7.1, p50: 8.9, p97: 11.3 },
  { month: 24, p3: 9.0, p50: 11.5, p97: 14.8 },
  { month: 36, p3: 10.8, p50: 13.9, p97: 18.1 },
  { month: 60, p3: 13.7, p50: 18.2, p97: 24.9 },
  { month: 120, p3: 23.5, p50: 32.8, p97: 46.0 },
  { month: 216, p3: 42.0, p50: 52.5, p97: 67.0 },
];

const HEAD_MALE: PercentilePoint[] = [
  { month: 0, p3: 31.9, p50: 34.5, p97: 37.0 },
  { month: 3, p3: 38.1, p50: 40.5, p97: 42.9 },
  { month: 6, p3: 40.9, p50: 43.3, p97: 45.8 },
  { month: 9, p3: 42.6, p50: 45.0, p97: 47.5 },
  { month: 12, p3: 43.6, p50: 46.1, p97: 48.6 },
  { month: 24, p3: 45.5, p50: 48.3, p97: 51.0 },
  { month: 36, p3: 46.6, p50: 49.5, p97: 52.3 },
  { month: 60, p3: 47.8, p50: 50.8, p97: 53.8 },
  { month: 120, p3: 49.8, p50: 53.0, p97: 56.2 },
  { month: 216, p3: 52.5, p50: 56.0, p97: 59.5 },
];
const HEAD_FEMALE: PercentilePoint[] = [
  { month: 0, p3: 31.5, p50: 33.9, p97: 36.2 },
  { month: 3, p3: 37.1, p50: 39.5, p97: 41.9 },
  { month: 6, p3: 39.8, p50: 42.2, p97: 44.6 },
  { month: 9, p3: 41.5, p50: 43.8, p97: 46.3 },
  { month: 12, p3: 42.5, p50: 44.9, p97: 47.4 },
  { month: 24, p3: 44.4, p50: 47.2, p97: 50.0 },
  { month: 36, p3: 45.6, p50: 48.5, p97: 51.3 },
  { month: 60, p3: 46.9, p50: 49.9, p97: 52.9 },
  { month: 120, p3: 49.0, p50: 52.2, p97: 55.4 },
  { month: 216, p3: 51.5, p50: 54.8, p97: 58.0 },
];

const CHEST_MALE: PercentilePoint[] = [
  { month: 0, p3: 30.5, p50: 33.0, p97: 35.6 },
  { month: 3, p3: 38.2, p50: 41.2, p97: 44.2 },
  { month: 6, p3: 41.0, p50: 44.2, p97: 47.5 },
  { month: 9, p3: 42.8, p50: 46.0, p97: 49.3 },
  { month: 12, p3: 44.0, p50: 47.2, p97: 50.6 },
  { month: 24, p3: 46.5, p50: 50.0, p97: 53.8 },
  { month: 36, p3: 48.2, p50: 52.0, p97: 56.2 },
  { month: 60, p3: 51.0, p50: 55.5, p97: 60.8 },
  { month: 120, p3: 58.0, p50: 65.0, p97: 74.0 },
  { month: 216, p3: 74.0, p50: 84.0, p97: 96.0 },
];
const CHEST_FEMALE: PercentilePoint[] = [
  { month: 0, p3: 30.0, p50: 32.5, p97: 35.0 },
  { month: 3, p3: 37.2, p50: 40.1, p97: 43.2 },
  { month: 6, p3: 39.8, p50: 43.0, p97: 46.2 },
  { month: 9, p3: 41.6, p50: 44.8, p97: 48.1 },
  { month: 12, p3: 42.8, p50: 46.0, p97: 49.4 },
  { month: 24, p3: 45.3, p50: 48.8, p97: 52.6 },
  { month: 36, p3: 47.0, p50: 50.8, p97: 55.0 },
  { month: 60, p3: 49.8, p50: 54.3, p97: 59.5 },
  { month: 120, p3: 57.0, p50: 64.0, p97: 73.0 },
  { month: 216, p3: 70.0, p50: 79.0, p97: 90.0 },
];

const FOOT_MALE: PercentilePoint[] = [
  { month: 0, p3: 7.2, p50: 8.2, p97: 9.2 },
  { month: 3, p3: 8.4, p50: 9.4, p97: 10.5 },
  { month: 6, p3: 9.5, p50: 10.6, p97: 11.7 },
  { month: 9, p3: 10.5, p50: 11.6, p97: 12.7 },
  { month: 12, p3: 11.4, p50: 12.5, p97: 13.6 },
  { month: 24, p3: 13.0, p50: 14.3, p97: 15.6 },
  { month: 36, p3: 14.2, p50: 15.6, p97: 17.0 },
  { month: 60, p3: 16.2, p50: 17.8, p97: 19.5 },
  { month: 120, p3: 20.5, p50: 22.5, p97: 24.5 },
  { month: 216, p3: 24.0, p50: 26.5, p97: 29.0 },
];
const FOOT_FEMALE: PercentilePoint[] = [
  { month: 0, p3: 7.0, p50: 8.0, p97: 9.0 },
  { month: 3, p3: 8.1, p50: 9.1, p97: 10.2 },
  { month: 6, p3: 9.2, p50: 10.3, p97: 11.4 },
  { month: 9, p3: 10.2, p50: 11.3, p97: 12.4 },
  { month: 12, p3: 11.0, p50: 12.1, p97: 13.2 },
  { month: 24, p3: 12.6, p50: 13.9, p97: 15.2 },
  { month: 36, p3: 13.8, p50: 15.2, p97: 16.6 },
  { month: 60, p3: 15.8, p50: 17.4, p97: 19.0 },
  { month: 120, p3: 20.0, p50: 22.0, p97: 24.0 },
  { month: 216, p3: 22.0, p50: 24.0, p97: 26.0 },
];

export const GROWTH_METRICS: GrowthMetricConfig[] = [
  {
    category: RecordCategory.HEIGHT,
    label: '身長',
    icon: '📏',
    unit: 'cm',
    color: '#10B981',
    minY: 45,
    maxY: 85,
    percentilesByGender: {
      male: HEIGHT_MALE,
      female: HEIGHT_FEMALE,
      unspecified: buildAveragedPercentiles(HEIGHT_MALE, HEIGHT_FEMALE),
    },
  },
  {
    category: RecordCategory.WEIGHT,
    label: '体重',
    icon: '⚖️',
    unit: 'kg',
    color: '#3B82F6',
    minY: 2,
    maxY: 13,
    percentilesByGender: {
      male: WEIGHT_MALE,
      female: WEIGHT_FEMALE,
      unspecified: buildAveragedPercentiles(WEIGHT_MALE, WEIGHT_FEMALE),
    },
  },
  {
    category: RecordCategory.HEAD_CIRCUMFERENCE,
    label: '頭囲',
    icon: '🧢',
    unit: 'cm',
    color: '#14B8A6',
    minY: 30,
    maxY: 50,
    percentilesByGender: {
      male: HEAD_MALE,
      female: HEAD_FEMALE,
      unspecified: buildAveragedPercentiles(HEAD_MALE, HEAD_FEMALE),
    },
  },
  {
    category: RecordCategory.CHEST_CIRCUMFERENCE,
    label: '胸囲',
    icon: '👕',
    unit: 'cm',
    color: '#8B5CF6',
    minY: 30,
    maxY: 52,
    percentilesByGender: {
      male: CHEST_MALE,
      female: CHEST_FEMALE,
      unspecified: buildAveragedPercentiles(CHEST_MALE, CHEST_FEMALE),
    },
  },
  {
    category: RecordCategory.FOOT_SIZE,
    label: '足のサイズ',
    icon: '👟',
    unit: 'cm',
    color: '#D97706',
    minY: 6,
    maxY: 16,
    percentilesByGender: {
      male: FOOT_MALE,
      female: FOOT_FEMALE,
      unspecified: buildAveragedPercentiles(FOOT_MALE, FOOT_FEMALE),
    },
  },
];

export function interpolatePercentileAtMonth(
  curve: PercentilePoint[],
  targetMonth: number
): { p3: number; p50: number; p97: number } {
  if (curve.length === 0) {
    return { p3: 0, p50: 0, p97: 0 };
  }
  if (targetMonth <= curve[0].month) {
    return { p3: curve[0].p3, p50: curve[0].p50, p97: curve[0].p97 };
  }
  const last = curve[curve.length - 1];
  if (targetMonth >= last.month) {
    return { p3: last.p3, p50: last.p50, p97: last.p97 };
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (targetMonth >= a.month && targetMonth <= b.month) {
      const span = b.month - a.month;
      const ratio = span > 0 ? (targetMonth - a.month) / span : 0;
      return {
        p3: a.p3 + (b.p3 - a.p3) * ratio,
        p50: a.p50 + (b.p50 - a.p50) * ratio,
        p97: a.p97 + (b.p97 - a.p97) * ratio,
      };
    }
  }
  return { p3: last.p3, p50: last.p50, p97: last.p97 };
}

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMonthDayWithDow(date: Date): string {
  const dow = WEEKDAY_NAMES[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${dow})`;
}

function formatHm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 1日分の食事・排泄イベント生データ
 */
export interface RawDayTimelineEvent {
  id: string;
  record: RecordModel;
  category: RecordCategory;
  minutesOfDay: number;
  endMinutesOfDay?: number | null;
  timeStr: string;
  icon: string;
  color: string;
  bgColor: string;
  shortLabel: string;
  amount: number | null;
  unit?: string;
  excretionType?: 'pee' | 'poop' | 'both';
}

/**
 * Microsoft Outlook 予定表方式で重なり回避レイアウト済みのイベントデータ
 */
export interface PositionedDayTimelineEvent extends RawDayTimelineEvent {
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
  colIndex: number;
  totalCols: number;
  effectiveStartMin: number;
  effectiveEndMin: number;
}

/**
 * Microsoft Outlook 予定表アルゴリズムに基づく1日内イベントの重なり回避レイアウト関数
 *
 * - 要件定義 FR-05 に従い、各イベントを `[start_min, max(end_min, start_min + 30)]` の時間区間（最小占有枠 30分）として扱い、
 *   区間が重なるイベント群を「衝突クラスタ (collision cluster)」としてグループ化する。
 * - クラスタ内の各イベントに対し、左から順に空いている列 (column) を貪欲法で割り当て、
 *   横幅 (`100 / totalCols %`) と水平位置 (`colIndex / totalCols * 100 %`)、
 *   および縦方向の占有高さ (`heightPct`) を算出する。
 */
export function layoutDayTimelineEvents(
  rawEvents: RawDayTimelineEvent[]
): PositionedDayTimelineEvent[] {
  if (rawEvents.length === 0) {
    return [];
  }

  // 要件定義 FR-05 準拠: 単発イベントの最小占有枠 30分
  const MIN_SLOT_MINUTES = 30;
  const MIN_START_MINUTES = 0;
  const MAX_START_MINUTES = 1440 - MIN_SLOT_MINUTES;

  const isMealCategory = (cat: RecordCategory): boolean =>
    cat === RecordCategory.MILK ||
    cat === RecordCategory.BABY_FOOD ||
    cat === RecordCategory.MEAL;

  // 表示用の開始位置（分）と終了位置（分）を付与して開始時刻順にソート
  const prepared = rawEvents
    .map((ev) => {
      const effectiveStartMin = Math.min(
        MAX_START_MINUTES,
        Math.max(MIN_START_MINUTES, ev.minutesOfDay)
      );
      const rawEndMin =
        ev.endMinutesOfDay !== undefined && ev.endMinutesOfDay !== null
          ? ev.endMinutesOfDay
          : effectiveStartMin + MIN_SLOT_MINUTES;
      const effectiveEndMin = Math.min(
        1440,
        Math.max(effectiveStartMin + MIN_SLOT_MINUTES, rawEndMin)
      );
      return {
        ...ev,
        effectiveStartMin,
        effectiveEndMin,
      };
    })
    .sort((a, b) => {
      if (a.effectiveStartMin !== b.effectiveStartMin) {
        return a.effectiveStartMin - b.effectiveStartMin;
      }
      // 同一時刻の場合は食事系を左、排泄系を右に揃える
      const aMeal = isMealCategory(a.category) ? 0 : 1;
      const bMeal = isMealCategory(b.category) ? 0 : 1;
      if (aMeal !== bMeal) {
        return aMeal - bMeal;
      }
      return a.id.localeCompare(b.id);
    });

  // 1. 互いに領域が重なる連結クラスタへ分割
  type PreparedEvent = (typeof prepared)[number];
  const clusters: PreparedEvent[][] = [];
  let currentCluster: PreparedEvent[] = [];
  let clusterMaxEnd = -1;

  for (const ev of prepared) {
    if (currentCluster.length === 0 || ev.effectiveStartMin < clusterMaxEnd) {
      currentCluster.push(ev);
      clusterMaxEnd = Math.max(clusterMaxEnd, ev.effectiveEndMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterMaxEnd = ev.effectiveEndMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // 2. 各クラスタ内で Outlook 方式のカラム割り当てを実施
  const positioned: PositionedDayTimelineEvent[] = [];

  for (const cluster of clusters) {
    const columnsEndMin: number[] = [];
    const assignedWithCol: Array<PreparedEvent & { colIndex: number }> = [];

    for (const ev of cluster) {
      let targetCol = -1;
      for (let c = 0; c < columnsEndMin.length; c++) {
        if (columnsEndMin[c] <= ev.effectiveStartMin) {
          targetCol = c;
          break;
        }
      }
      if (targetCol === -1) {
        targetCol = columnsEndMin.length;
        columnsEndMin.push(ev.effectiveEndMin);
      } else {
        columnsEndMin[targetCol] = ev.effectiveEndMin;
      }

      assignedWithCol.push({
        ...ev,
        colIndex: targetCol,
      });
    }

    const totalCols = columnsEndMin.length;

    for (const ev of assignedWithCol) {
      // 右隣のカラムがこのイベントの表示区間と衝突しない場合は横幅を拡張可能にする
      let colSpan = 1;
      for (let c = ev.colIndex + 1; c < totalCols; c++) {
        const hasConflictInCol = assignedWithCol.some(
          (other) =>
            other.colIndex === c &&
            other.effectiveStartMin < ev.effectiveEndMin &&
            ev.effectiveStartMin < other.effectiveEndMin
        );
        if (hasConflictInCol) {
          break;
        }
        colSpan += 1;
      }

      const durationMinutes = Math.max(
        MIN_SLOT_MINUTES,
        ev.effectiveEndMin - ev.effectiveStartMin
      );

      positioned.push({
        ...ev,
        topPct: (ev.effectiveStartMin / 1440) * 100,
        heightPct: (durationMinutes / 1440) * 100,
        leftPct: (ev.colIndex / totalCols) * 100,
        widthPct: (colSpan / totalCols) * 100,
        colIndex: ev.colIndex,
        totalCols,
        effectiveStartMin: ev.effectiveStartMin,
        effectiveEndMin: ev.effectiveEndMin,
      });
    }
  }

  return positioned;
}

/**
 * 2点間を結ぶ純粋React Native折れ線描画コンポーネント
 */
interface LinePoint {
  id: string;
  xRatio: number; // 0..1
  yRatio: number; // 0..1 (0 = bottom, 1 = top)
  labelX: string;
  value: number;
  subLabel?: string;
  isAlert?: boolean;
}

interface PolylineChartProps {
  points: LinePoint[];
  minY: number;
  maxY: number;
  unit: string;
  lineColor: string;
  height?: number;
  referenceLineValue?: number;
  referenceLineLabel?: string;
  bandPoints?: Array<{ xRatio: number; low: number; median?: number; high: number }>;
}

const PolylineChart: React.FC<PolylineChartProps> = ({
  points,
  minY,
  maxY,
  unit,
  lineColor,
  height = 220,
  referenceLineValue,
  referenceLineLabel,
  bandPoints,
}) => {
  const theme = useAppTheme();
  const [plotWidth, setPlotWidth] = useState<number>(300);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setPlotWidth(w);
    }
  }, []);

  const yTicks = useMemo(() => {
    const step = (maxY - minY) / 4;
    return [0, 1, 2, 3, 4].map((i) => Number((maxY - step * i).toFixed(1)));
  }, [maxY, minY]);

  const pixelPoints = useMemo(() => {
    const padX = 18;
    const usableW = Math.max(plotWidth - padX * 2, 40);
    const padY = 16;
    const usableH = height - padY * 2;

    return points.map((pt) => {
      const clampedY = Math.max(0, Math.min(1, pt.yRatio));
      return {
        ...pt,
        px: padX + pt.xRatio * usableW,
        py: padY + (1 - clampedY) * usableH,
      };
    });
  }, [height, plotWidth, points]);

  const padY = 16;
  const usableH = height - padY * 2;
  const padX = 18;
  const usableW = Math.max(plotWidth - padX * 2, 40);

  // 3〜97パーセンタイル連続シェード帯（24分割ストリップ）と50パーセンタイル中央値破線
  const continuousBandStrips = useMemo(() => {
    if (!bandPoints || bandPoints.length === 0) return [];
    const sorted = [...bandPoints].sort((a, b) => a.xRatio - b.xRatio);
    const steps = 28;
    const strips: Array<{
      key: string;
      left: number;
      top: number;
      width: number;
      height: number;
      medianPx: number;
      medianPy: number | null;
    }> = [];

    const interpAt = (r: number) => {
      if (r <= sorted[0].xRatio) return sorted[0];
      const last = sorted[sorted.length - 1];
      if (r >= last.xRatio) return last;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (r >= a.xRatio && r <= b.xRatio) {
          const span = b.xRatio - a.xRatio;
          const t = span > 0 ? (r - a.xRatio) / span : 0;
          return {
            xRatio: r,
            low: a.low + (b.low - a.low) * t,
            median:
              a.median !== undefined && b.median !== undefined
                ? a.median + (b.median - a.median) * t
                : (a.low + a.high + b.low + b.high) / 4,
            high: a.high + (b.high - a.high) * t,
          };
        }
      }
      return last;
    };

    const stripWidth = usableW / steps + 1.5;
    for (let s = 0; s <= steps; s++) {
      const r = s / steps;
      const sample = interpAt(r);
      const highRatio = Math.max(
        0,
        Math.min(1, (sample.high - minY) / (maxY - minY))
      );
      const lowRatio = Math.max(
        0,
        Math.min(1, (sample.low - minY) / (maxY - minY))
      );
      const medianVal =
        sample.median !== undefined
          ? sample.median
          : (sample.low + sample.high) / 2;
      const medianRatio = Math.max(
        0,
        Math.min(1, (medianVal - minY) / (maxY - minY))
      );
      const topPx = padY + (1 - highRatio) * usableH;
      const bottomPx = padY + (1 - lowRatio) * usableH;
      const medianPy = padY + (1 - medianRatio) * usableH;
      const bx = padX + r * usableW;

      strips.push({
        key: `strip-${s}`,
        left: bx - stripWidth / 2,
        top: topPx,
        width: stripWidth,
        height: Math.max(bottomPx - topPx, 3),
        medianPx: bx,
        medianPy,
      });
    }
    return strips;
  }, [bandPoints, maxY, minY, padX, padY, usableH, usableW]);

  const refLineTop = useMemo(() => {
    if (referenceLineValue === undefined) return null;
    const ratio = (referenceLineValue - minY) / (maxY - minY);
    if (ratio < 0 || ratio > 1) return null;
    return padY + (1 - ratio) * usableH;
  }, [maxY, minY, referenceLineValue, usableH]);

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartMainRow}>
        {/* Y軸ラベル */}
        <View style={[styles.yAxisColumn, { height }]}>
          {yTicks.map((val) => (
            <Text
              key={String(val)}
              style={[styles.yAxisText, { color: theme.chartAxisText }]}
            >
              {val}
            </Text>
          ))}
        </View>

        {/* プロット領域 */}
        <View
          style={[
            styles.plotCanvas,
            {
              height,
              backgroundColor: theme.chartCanvasBg,
              borderColor: theme.border,
            },
          ]}
          onLayout={handleLayout}
        >
          {/* 水平グリッド線 */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <View
              key={String(r)}
              style={[
                styles.gridLineHorizontal,
                {
                  top: padY + r * usableH,
                  backgroundColor: theme.chartGridLine,
                },
              ]}
            />
          ))}

          {/* 標準発育帯（3〜97パーセンタイル連続シェード帯） */}
          {continuousBandStrips.map((strip) => (
            <View
              key={strip.key}
              style={{
                position: 'absolute',
                left: strip.left,
                top: strip.top,
                width: strip.width,
                height: strip.height,
                backgroundColor: theme.isDark
                  ? `${lineColor}26`
                  : `${lineColor}1C`,
              }}
            />
          ))}

          {/* 50パーセンタイル（中央値）破線 */}
          {continuousBandStrips.map((strip, idx) => {
            if (idx === 0 || idx % 2 === 1) return null;
            const prev = continuousBandStrips[idx - 1];
            if (prev.medianPy === null || strip.medianPy === null) return null;
            const dx = strip.medianPx - prev.medianPx;
            const dy = strip.medianPy - prev.medianPy;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (prev.medianPx + strip.medianPx) / 2;
            const cy = (prev.medianPy + strip.medianPy) / 2;
            return (
              <View
                key={`p50-${strip.key}`}
                style={{
                  position: 'absolute',
                  left: cx - length / 2,
                  top: cy - 1,
                  width: length,
                  height: 1.5,
                  backgroundColor: theme.isDark
                    ? `${lineColor}AA`
                    : `${lineColor}88`,
                  transform: [{ rotate: `${angleDeg}deg` }],
                }}
              />
            );
          })}

          {/* 基準線（37.5℃発熱目安ライン等） */}
          {refLineTop !== null ? (
            <View
              style={[
                styles.referenceLine,
                { top: refLineTop },
              ]}
            >
              {referenceLineLabel ? (
                <Text
                  style={[
                    styles.referenceLineText,
                    {
                      backgroundColor: theme.isDark ? '#450A0A' : '#FEF2F2',
                      color: theme.dangerText,
                    },
                  ]}
                >
                  {referenceLineLabel}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* 点と点を結ぶ線分 */}
          {pixelPoints.map((pt, idx) => {
            if (idx === 0) return null;
            const prev = pixelPoints[idx - 1];
            const dx = pt.px - prev.px;
            const dy = pt.py - prev.py;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (prev.px + pt.px) / 2;
            const cy = (prev.py + pt.py) / 2;

            return (
              <View
                key={`seg-${pt.id}`}
                style={{
                  position: 'absolute',
                  left: cx - length / 2,
                  top: cy - 1.5,
                  width: length,
                  height: 3,
                  backgroundColor: lineColor,
                  borderRadius: 1.5,
                  transform: [{ rotate: `${angleDeg}deg` }],
                }}
              />
            );
          })}

          {/* データプロット点＋数値ラベル */}
          {pixelPoints.map((pt) => {
            const dotColor = pt.isAlert ? theme.dangerText : lineColor;
            return (
              <View
                key={`dot-${pt.id}`}
                style={{
                  position: 'absolute',
                  left: pt.px - 24,
                  top: pt.py - 26,
                  width: 48,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={[
                    styles.pointValueLabel,
                    { color: theme.textPrimary },
                    pt.isAlert && { color: theme.dangerText, fontWeight: '800' },
                  ]}
                >
                  {pt.value}
                </Text>
                <View
                  style={[
                    styles.pointDot,
                    {
                      backgroundColor: theme.bgCard,
                      borderColor: dotColor,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* X軸ラベル */}
      <View style={styles.xAxisRow}>
        {pixelPoints.length <= 8
          ? pixelPoints.map((pt) => (
              <Text
                key={`xl-${pt.id}`}
                style={[styles.xAxisText, { color: theme.chartAxisText }]}
              >
                {pt.labelX}
              </Text>
            ))
          : [
              pixelPoints[0],
              pixelPoints[Math.floor(pixelPoints.length / 2)],
              pixelPoints[pixelPoints.length - 1],
            ].map((pt) => (
              <Text
                key={`xl-${pt.id}`}
                style={[styles.xAxisText, { color: theme.chartAxisText }]}
              >
                {pt.labelX}
              </Text>
            ))}
      </View>
      <Text style={[styles.unitCaption, { color: theme.textMuted }]}>
        単位: {unit}
      </Text>
    </View>
  );
};

export interface AnalyticsScreenExternalProps {
  childId: string;
  activeUserId?: string | null;
  activeUserRole?: UserRole;
  onOpenCreateModal: (defaultCategory?: RecordCategory) => void;
  onEditRecord?: (record: RecordModel) => void;
}

interface AnalyticsScreenInjectedProps extends AnalyticsScreenExternalProps {
  child: Child;
  records: RecordModel[];
}

const RawAnalyticsScreen: React.FC<AnalyticsScreenInjectedProps> = ({
  child,
  records,
  activeUserId,
  activeUserRole,
  onOpenCreateModal,
  onEditRecord,
}) => {
  const theme = useAppTheme();
  const canWrite = activeUserRole !== UserRole.VIEWER;
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('growth');
  const [selectedGrowthMetric, setSelectedGrowthMetric] =
    useState<GrowthMetricCategory>(RecordCategory.HEIGHT);
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = 直近7日間, -1 = その前7日間...
  const [mealExcretionFilter, setMealExcretionFilter] = useState<
    'all' | 'meal' | 'excretion'
  >('all');
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const handleSeedSamples = useCallback(async () => {
    if (isSeeding || !canWrite) return;
    setIsSeeding(true);
    try {
      await seedSampleAnalyticsRecords(child.id, activeUserId);
    } finally {
      setIsSeeding(false);
    }
  }, [activeUserId, canWrite, child.id, isSeeding]);

  // --- 対象週の7日間配列を計算 (weekOffset = 0 の場合は今日を含む直近7日間) ---
  const weekDays = useMemo(() => {
    const now = new Date();
    const endDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + weekOffset * 7,
      0,
      0,
      0
    );
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(
        new Date(
          endDay.getFullYear(),
          endDay.getMonth(),
          endDay.getDate() - i,
          0,
          0,
          0
        )
      );
    }
    return days;
  }, [weekOffset]);

  // ============================================================================
  // 1. 成長曲線データの集計 (身長・体重・頭囲・胸囲・足のサイズ)
  // ============================================================================
  const activeGrowthConfig = useMemo(
    () =>
      GROWTH_METRICS.find((m) => m.category === selectedGrowthMetric) ??
      GROWTH_METRICS[0],
    [selectedGrowthMetric]
  );

  const genderPercentileCurve = useMemo(() => {
    if (child.gender === Gender.MALE) {
      return activeGrowthConfig.percentilesByGender.male;
    }
    if (child.gender === Gender.FEMALE) {
      return activeGrowthConfig.percentilesByGender.female;
    }
    return activeGrowthConfig.percentilesByGender.unspecified;
  }, [activeGrowthConfig, child.gender]);

  const growthRecords = useMemo(() => {
    return records
      .filter(
        (r) =>
          r.category === selectedGrowthMetric &&
          r.amount !== null &&
          r.amount !== undefined
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [records, selectedGrowthMetric]);

  // 子どもの現在月齢と計測レコード最大月齢から X軸上限 (12, 24, 36, 60, 120, 216ヶ月) と Y軸レンジを動的に決定
  const growthAxisBounds = useMemo(() => {
    const birthDate = child.birthDateAsDate;
    const currentAgeMonths = calculateAgeInMonths(birthDate, new Date());
    const maxRecordMonth = growthRecords.reduce((acc, rec) => {
      const m = calculateAgeInMonths(birthDate, rec.startTime);
      return Math.max(acc, m);
    }, 0);
    const targetMax = Math.max(12, currentAgeMonths, maxRecordMonth);
    const horizonPresets = [12, 24, 36, 60, 120, 216];
    const maxMonth =
      horizonPresets.find((h) => h >= targetMax) ??
      Math.ceil(targetMax / 12) * 12;

    const endPercentile = interpolatePercentileAtMonth(
      genderPercentileCurve,
      maxMonth
    );
    const startPercentile = interpolatePercentileAtMonth(
      genderPercentileCurve,
      0
    );
    const recordValues = growthRecords.map((r) => r.amount ?? 0);
    const rawMin = Math.min(
      activeGrowthConfig.minY,
      startPercentile.p3,
      ...(recordValues.length > 0 ? recordValues : [activeGrowthConfig.minY])
    );
    const rawMax = Math.max(
      activeGrowthConfig.maxY,
      endPercentile.p97,
      ...(recordValues.length > 0 ? recordValues : [activeGrowthConfig.maxY])
    );
    const minY = Math.max(0, Math.floor(rawMin - 2));
    const maxY = Math.ceil(rawMax + 2);
    return { maxMonth, minY, maxY };
  }, [activeGrowthConfig, child.birthDateAsDate, genderPercentileCurve, growthRecords]);

  const growthChartPoints = useMemo<LinePoint[]>(() => {
    if (growthRecords.length === 0) return [];
    const birthDate = child.birthDateAsDate;
    const { maxMonth, minY, maxY } = growthAxisBounds;

    return growthRecords.map((rec, idx) => {
      const val = rec.amount ?? 0;
      const ageMonths = !Number.isNaN(birthDate.getTime())
        ? calculateAgeInMonths(birthDate, rec.startTime)
        : idx * 2;
      const xRatio =
        growthRecords.length === 1
          ? Math.min(0.95, Math.max(0.05, ageMonths / maxMonth))
          : Math.min(1, Math.max(0, ageMonths / maxMonth));
      const yRatio = (val - minY) / Math.max(1, maxY - minY);

      return {
        id: rec.id,
        xRatio,
        yRatio,
        labelX: `${Math.round(ageMonths * 10) / 10}ヶ月 (${formatMonthDay(
          rec.startTime
        )})`,
        value: Number(val.toFixed(1)),
      };
    });
  }, [child.birthDateAsDate, growthAxisBounds, growthRecords]);

  const growthBandPoints = useMemo(() => {
    const { maxMonth } = growthAxisBounds;
    const relevantPoints = genderPercentileCurve.filter(
      (pt) => pt.month <= maxMonth
    );
    const endSample = interpolatePercentileAtMonth(
      genderPercentileCurve,
      maxMonth
    );
    const merged = [
      ...relevantPoints,
      ...(relevantPoints.some((p) => p.month === maxMonth)
        ? []
        : [{ month: maxMonth, ...endSample }]),
    ];
    return merged.map((b) => ({
      xRatio: b.month / maxMonth,
      low: b.p3,
      median: b.p50,
      high: b.p97,
    }));
  }, [genderPercentileCurve, growthAxisBounds]);

  // ============================================================================
  // 2. 食事・排泄の週単位タイムプロットデータ
  // ============================================================================
  const weeklyMealExcretionByDay = useMemo(() => {
    const mealCategories: RecordCategory[] = [
      RecordCategory.MILK,
      RecordCategory.BABY_FOOD,
      RecordCategory.MEAL,
    ];

    return weekDays.map((dayStart) => {
      const dayEnd = new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate() + 1,
        0,
        0,
        0
      );

      const dayRecords = records.filter((rec) => {
        const t = rec.startTime.getTime();
        if (t < dayStart.getTime() || t >= dayEnd.getTime()) return false;
        const isMeal = mealCategories.includes(rec.category);
        const isExcretion = rec.category === RecordCategory.EXCRETION;
        if (mealExcretionFilter === 'meal') return isMeal;
        if (mealExcretionFilter === 'excretion') return isExcretion;
        return isMeal || isExcretion;
      });

      const rawEvents: RawDayTimelineEvent[] = dayRecords.map((rec) => {
        const minutesOfDay =
          rec.startTime.getHours() * 60 + rec.startTime.getMinutes();
        const endMinutesOfDay = rec.endTime
          ? Math.min(
              1440,
              Math.max(
                minutesOfDay + 30,
                Math.round(
                  (rec.endTime.getTime() - dayStart.getTime()) / (60 * 1000)
                )
              )
            )
          : null;
        const meta = rec.parsedMetadata;
        let icon = RECORD_CATEGORY_CONFIGS[rec.category]?.icon ?? '📝';
        let color =
          RECORD_CATEGORY_CONFIGS[rec.category]?.accentColor ?? '#64748B';
        let bgColor = '#F8FAFC';
        let shortLabel = RECORD_CATEGORY_CONFIGS[rec.category]?.label ?? '';

        if (rec.category === RecordCategory.MILK) {
          bgColor = theme.isDark ? '#3B2119' : '#FFF3EF';
        } else if (rec.category === RecordCategory.BABY_FOOD) {
          bgColor = theme.isDark ? '#3B2A14' : '#FFF8EB';
        } else if (rec.category === RecordCategory.MEAL) {
          bgColor = theme.isDark ? '#1E3318' : '#F4FCE3';
        } else if (rec.category === RecordCategory.EXCRETION) {
          if (meta.excretion_type === 'poop') {
            icon = '💩';
            color = '#D97706';
            bgColor = theme.isDark ? '#3B2810' : '#FEF3C7';
            shortLabel = 'うんち';
          } else if (meta.excretion_type === 'both') {
            icon = '✨';
            color = '#0284C7';
            bgColor = theme.isDark ? '#102A3F' : '#E0F2FE';
            shortLabel = '両方';
          } else {
            icon = '💧';
            color = '#06B6D4';
            bgColor = theme.isDark ? '#10323B' : '#ECFEFF';
            shortLabel = 'おしっこ';
          }
        }

        return {
          id: rec.id,
          record: rec,
          category: rec.category,
          minutesOfDay,
          endMinutesOfDay,
          timeStr: formatHm(rec.startTime),
          icon,
          color,
          bgColor,
          shortLabel,
          amount: rec.amount,
          unit: meta.unit,
          excretionType: meta.excretion_type,
        };
      });

      // Microsoft Outlook 予定表方式で近接時間帯のイベントをマルチカラムに分割配置
      const events = layoutDayTimelineEvents(rawEvents);

      const mealCount = dayRecords.filter((r) =>
        mealCategories.includes(r.category)
      ).length;
      const milkTotalMl = dayRecords
        .filter((r) => r.category === RecordCategory.MILK)
        .reduce((acc, r) => acc + (r.amount ?? 0), 0);
      const excretionCount = dayRecords.filter(
        (r) => r.category === RecordCategory.EXCRETION
      ).length;

      return {
        date: dayStart,
        events,
        mealCount,
        milkTotalMl,
        excretionCount,
      };
    });
  }, [mealExcretionFilter, records, theme.isDark, weekDays]);

  // ============================================================================
  // 3. 睡眠の開始・終了 週単位タイムバーデータ
  // ============================================================================
  const weeklySleepByDay = useMemo(() => {
    const sleepRecords = records.filter(
      (r) => r.category === RecordCategory.SLEEP
    );
    const nowMs = Date.now();

    return weekDays.map((dayStart) => {
      const dayStartMs = dayStart.getTime();
      const dayEndMs = new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate() + 1,
        0,
        0,
        0
      ).getTime();

      const blocks: Array<{
        id: string;
        startMinute: number;
        endMinute: number;
        label: string;
        durationMinutes: number;
        durationHours: number;
        isOngoing: boolean;
      }> = [];

      for (const rec of sleepRecords) {
        const sMs = rec.startTime.getTime();
        const isOngoing = rec.endTime === null;
        // 終了未入力時は現在時刻までの暫定バーとして表示（現在時刻が開始より前の場合は最小15分）
        const eMs = rec.endTime
          ? rec.endTime.getTime()
          : Math.max(sMs + 15 * 60 * 1000, nowMs);

        // 当日と重なる区間を切り出す（日跨ぎ睡眠も正確に分割表示）
        const overlapStart = Math.max(sMs, dayStartMs);
        const overlapEnd = Math.min(eMs, dayEndMs);

        if (overlapEnd > overlapStart) {
          const startMin = (overlapStart - dayStartMs) / (60 * 1000);
          const endMin = (overlapEnd - dayStartMs) / (60 * 1000);
          const durMinutes = endMin - startMin;
          const durHours = durMinutes / 60;
          blocks.push({
            id: `${rec.id}-${dayStartMs}`,
            startMinute: startMin,
            endMinute: endMin,
            label: isOngoing
              ? `${formatHm(new Date(overlapStart))}〜睡眠中`
              : `${formatHm(new Date(overlapStart))}〜${formatHm(
                  new Date(overlapEnd)
                )}`,
            durationMinutes: durMinutes,
            durationHours: durHours,
            isOngoing,
          });
        }
      }

      const totalMinutes = blocks.reduce(
        (acc, b) => acc + b.durationMinutes,
        0
      );
      const totalHours = totalMinutes / 60;

      return {
        date: dayStart,
        blocks,
        totalMinutes: Math.round(totalMinutes),
        totalHours: Number(totalHours.toFixed(1)),
      };
    });
  }, [records, weekDays]);

  // 要件定義 FR-05 準拠: 7日間の睡眠0の日も含めた分単位按分による週平均睡眠時間
  const weeklyAverageSleepMinutes = useMemo(() => {
    if (weeklySleepByDay.length === 0) return 0;
    const totalWeekMinutes = weeklySleepByDay.reduce(
      (acc, d) => acc + d.totalMinutes,
      0
    );
    return Math.round(totalWeekMinutes / 7);
  }, [weeklySleepByDay]);

  // ============================================================================
  // 4. 体温推移の折れ線グラフデータ
  // ============================================================================
  const bodyTempRecords = useMemo(() => {
    return records
      .filter(
        (r) =>
          r.category === RecordCategory.BODY_TEMP &&
          r.amount !== null &&
          r.amount !== undefined
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(-14); // 直近14件を表示
  }, [records]);

  const bodyTempPoints = useMemo<LinePoint[]>(() => {
    if (bodyTempRecords.length === 0) return [];
    const minTemp = 35.5;
    const maxTemp = 39.5;
    return bodyTempRecords.map((rec, idx) => {
      const val = rec.amount ?? 36.5;
      const xRatio =
        bodyTempRecords.length === 1
          ? 0.5
          : idx / (bodyTempRecords.length - 1);
      const yRatio = (val - minTemp) / (maxTemp - minTemp);

      return {
        id: rec.id,
        xRatio,
        yRatio,
        labelX: `${formatMonthDay(rec.startTime)} ${formatHm(rec.startTime)}`,
        value: Number(val.toFixed(1)),
        isAlert: val >= 37.5,
      };
    });
  }, [bodyTempRecords]);

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
            📊 {child.name} の成長・生活リズム分析
          </Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
            性別: {GENDER_LABELS[child.gender]} / 生年月日: {child.birthDate}
          </Text>
        </View>

        {canWrite ? (
          <TouchableOpacity
            style={[
              styles.sampleButton,
              {
                backgroundColor: theme.primarySoftBg,
                borderColor: theme.primaryBorder,
              },
            ]}
            onPress={handleSeedSamples}
            disabled={isSeeding}
          >
            <Text style={[styles.sampleButtonText, { color: theme.primary }]}>
              {isSeeding ? '投入中...' : '✨ サンプル補完'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4つのグラフ切り替えナビゲーション */}
      <View
        style={[
          styles.subTabBar,
          { backgroundColor: theme.bgCard, borderBottomColor: theme.border },
        ]}
      >
        {(
          [
            { key: 'growth', label: '📈 成長曲線' },
            { key: 'meal_excretion', label: '🍽️ 食事・排泄(週)' },
            { key: 'sleep', label: '🌙 睡眠(週)' },
            { key: 'temperature', label: '🌡️ 体温推移' },
          ] as const
        ).map((tab) => {
          const isActive = subTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.subTabButton,
                { backgroundColor: theme.bgElevated },
                isActive && { backgroundColor: theme.primaryButtonBg },
              ]}
              onPress={() => setSubTab(tab.key)}
            >
              <Text
                style={[
                  styles.subTabText,
                  { color: theme.textSecondary },
                  isActive && styles.subTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ================================================================ */}
        {/* タブ1: 身長・体重・頭囲・胸囲・足のサイズの成長曲線               */}
        {/* ================================================================ */}
        {subTab === 'growth' ? (
          <View>
            {/* 5項目の切替チップ */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricSelectorRow}
            >
              {GROWTH_METRICS.map((m) => {
                const isSelected = m.category === selectedGrowthMetric;
                return (
                  <TouchableOpacity
                    key={m.category}
                    style={[
                      styles.metricChip,
                      {
                        backgroundColor: theme.bgCard,
                        borderColor: theme.borderStrong,
                      },
                      isSelected && {
                        backgroundColor: m.color,
                        borderColor: m.color,
                      },
                    ]}
                    onPress={() => setSelectedGrowthMetric(m.category)}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        { color: theme.textSecondary },
                        isSelected && styles.metricChipTextActive,
                      ]}
                    >
                      {m.icon} {m.label} ({m.unit})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    {activeGrowthConfig.icon} {activeGrowthConfig.label}の成長曲線
                  </Text>
                  <Text
                    style={[styles.cardSubtitle, { color: theme.textSecondary }]}
                  >
                    背景帯は性別（{GENDER_LABELS[child.gender]}）の3〜97パーセンタイル帯と中央値破線（0〜{growthAxisBounds.maxMonth}ヶ月）
                  </Text>
                </View>
                {canWrite ? (
                  <TouchableOpacity
                    style={[
                      styles.quickRecordButton,
                      { backgroundColor: theme.primaryButtonBg },
                    ]}
                    onPress={() => onOpenCreateModal(selectedGrowthMetric)}
                  >
                    <Text style={styles.quickRecordButtonText}>
                      ＋ {activeGrowthConfig.label}を記録
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {growthChartPoints.length > 0 ? (
                <PolylineChart
                  points={growthChartPoints}
                  minY={growthAxisBounds.minY}
                  maxY={growthAxisBounds.maxY}
                  unit={activeGrowthConfig.unit}
                  lineColor={theme.primary}
                  bandPoints={growthBandPoints}
                />
              ) : (
                <View
                  style={[
                    styles.emptyBox,
                    {
                      backgroundColor: theme.bgElevated,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.emptyBoxText, { color: theme.textSecondary }]}>
                    まだ「{activeGrowthConfig.label}」の記録がありません。右上のボタンから計測値を追加してください。
                  </Text>
                </View>
              )}

              {/* 最新の数値サマリ */}
              {growthRecords.length > 0 ? (
                <View style={styles.statSummaryRow}>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      最新計測値
                    </Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: activeGrowthConfig.color },
                      ]}
                    >
                      {growthRecords[growthRecords.length - 1].amount}{' '}
                      {activeGrowthConfig.unit}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      初回からの成長量
                    </Text>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      +
                      {(
                        (growthRecords[growthRecords.length - 1].amount ?? 0) -
                        (growthRecords[0].amount ?? 0)
                      ).toFixed(1)}{' '}
                      {activeGrowthConfig.unit}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      記録回数
                    </Text>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      {growthRecords.length} 回
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* 計測履歴テーブル */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                📋 {activeGrowthConfig.label}の計測履歴一覧
              </Text>
              {growthRecords
                .slice()
                .reverse()
                .map((rec) => (
                  <View
                    key={rec.id}
                    style={[
                      styles.historyRow,
                      { borderTopColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.historyDate, { color: theme.textPrimary }]}>
                      {rec.startTime.toLocaleDateString()}
                    </Text>
                    <Text
                      style={[styles.historyNote, { color: theme.textSecondary }]}
                    >
                      {rec.parsedMetadata.note ?? '定期計測'}
                    </Text>
                    <Text
                      style={[
                        styles.historyAmount,
                        { color: activeGrowthConfig.color },
                      ]}
                    >
                      {rec.amount} {activeGrowthConfig.unit}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        ) : null}

        {/* ================================================================ */}
        {/* タブ2: 食事・排泄の週単位タイムプロットグラフ                     */}
        {/* ================================================================ */}
        {subTab === 'meal_excretion' ? (
          <View>
            {/* 週ナビゲーション */}
            <View
              style={[
                styles.weekNavRow,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.weekNavBtn,
                  { backgroundColor: theme.bgElevated },
                ]}
                onPress={() => setWeekOffset((w) => w - 1)}
              >
                <Text style={[styles.weekNavBtnText, { color: theme.textPrimary }]}>
                  ◀ 前の7日間
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setWeekOffset(0)}>
                <Text style={[styles.weekRangeTitle, { color: theme.textPrimary }]}>
                  {formatMonthDayWithDow(weekDays[0])} 〜{' '}
                  {formatMonthDayWithDow(weekDays[6])}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.weekNavBtn,
                  { backgroundColor: theme.bgElevated },
                ]}
                onPress={() => setWeekOffset((w) => w + 1)}
              >
                <Text style={[styles.weekNavBtnText, { color: theme.textPrimary }]}>
                  次の7日間 ▶
                </Text>
              </TouchableOpacity>
            </View>

            {/* フィルタ切替 */}
            <View style={styles.filterPillRow}>
              {(
                [
                  { key: 'all', label: 'すべて (食事＋排泄)' },
                  { key: 'meal', label: '🍼🥣🍽️ 食事・授乳のみ' },
                  { key: 'excretion', label: '🧷 排泄のみ' },
                ] as const
              ).map((f) => {
                const isSelected = mealExcretionFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: theme.bgCard,
                        borderColor: theme.borderStrong,
                      },
                      isSelected && {
                        backgroundColor: theme.primaryButtonBg,
                        borderColor: theme.primaryButtonBg,
                      },
                    ]}
                    onPress={() => setMealExcretionFilter(f.key)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: theme.textSecondary },
                        isSelected && styles.filterPillTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    🍽️🧷 食事・排泄 週間タイムチャート (0:00〜24:00)
                  </Text>
                  <Text
                    style={[styles.cardSubtitle, { color: theme.textSecondary }]}
                  >
                    縦軸が時間帯（0時〜24時・最小占有枠30分）、横軸が各曜日の実施タイミング
                  </Text>
                </View>
                {canWrite ? (
                  <TouchableOpacity
                    style={[
                      styles.quickRecordButton,
                      { backgroundColor: '#F97316' },
                    ]}
                    onPress={() => onOpenCreateModal(RecordCategory.MILK)}
                  >
                    <Text style={styles.quickRecordButtonText}>＋ 記録追加</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* 凡例 */}
              <View style={styles.legendRow}>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  🍼 ミルク
                </Text>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  🥣 離乳食
                </Text>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  🍽️ 食事
                </Text>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  💧 おしっこ
                </Text>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  💩 うんち
                </Text>
                <Text style={[styles.legendItem, { color: theme.textSecondary }]}>
                  ✨ 両方
                </Text>
              </View>

              {/* 24時間 × 7日間 マトリクスプロット */}
              <View
                style={[
                  styles.timetableContainer,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.chartCanvasBg,
                  },
                ]}
              >
                {/* 時間軸ラベル (0, 6, 12, 18, 24) */}
                <View
                  style={[
                    styles.timeAxisCol,
                    {
                      borderRightColor: theme.border,
                      backgroundColor: theme.bgElevated,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dayHeaderSpacer,
                      { borderBottomColor: theme.border },
                    ]}
                  />
                  <View style={styles.timeAxisBody}>
                    {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hr) => (
                      <Text
                        key={hr}
                        style={[
                          styles.timeAxisLabel,
                          {
                            top: `${(hr / 24) * 100}%`,
                            color: theme.chartAxisText,
                          },
                        ]}
                      >
                        {hr}:00
                      </Text>
                    ))}
                  </View>
                </View>

                {/* 7日分のカラム */}
                {weeklyMealExcretionByDay.map((dayCol) => (
                  <View
                    key={dayCol.date.toISOString()}
                    style={[
                      styles.dayColumn,
                      { borderRightColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.dayHeaderBox,
                        {
                          borderBottomColor: theme.border,
                          backgroundColor: theme.bgElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayHeaderDate,
                          { color: theme.textPrimary },
                        ]}
                      >
                        {formatMonthDay(dayCol.date)}
                      </Text>
                      <Text
                        style={[
                          styles.dayHeaderDow,
                          { color: theme.textSecondary },
                        ]}
                      >
                        ({WEEKDAY_NAMES[dayCol.date.getDay()]})
                      </Text>
                    </View>

                    <View style={styles.dayTimelineTrack}>
                      {[0.25, 0.5, 0.75].map((r) => (
                        <View
                          key={String(r)}
                          style={[
                            styles.trackGridLine,
                            {
                              top: `${r * 100}%`,
                              backgroundColor: theme.chartGridLine,
                            },
                          ]}
                        />
                      ))}

                      {dayCol.events.map((ev) => (
                        <TouchableOpacity
                          key={ev.id}
                          activeOpacity={canWrite && onEditRecord ? 0.75 : 1}
                          onPress={() => {
                            if (canWrite) {
                              onEditRecord?.(ev.record);
                            }
                          }}
                          style={[
                            styles.eventMarkerBadge,
                            {
                              top: `${ev.topPct}%`,
                              height: `${Math.max(2.1, ev.heightPct)}%`,
                              left: `${ev.leftPct + 0.8}%`,
                              width: `${Math.max(12, ev.widthPct - 1.6)}%`,
                              borderColor: ev.color,
                              borderLeftColor: ev.color,
                              backgroundColor: ev.bgColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.eventMarkerIcon,
                              ev.totalCols >= 2 &&
                                styles.eventMarkerIconCompact,
                            ]}
                          >
                            {ev.icon}
                          </Text>
                          <Text
                            style={[
                              styles.eventMarkerTime,
                              { color: theme.textPrimary },
                              ev.totalCols >= 2 &&
                                styles.eventMarkerTimeCompact,
                            ]}
                            numberOfLines={1}
                          >
                            {ev.timeStr}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View
                      style={[
                        styles.dayFooterBox,
                        {
                          borderTopColor: theme.border,
                          backgroundColor: theme.bgElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayFooterStat,
                          { color: theme.textSecondary },
                        ]}
                      >
                        食:{dayCol.mealCount} / 排:{dayCol.excretionCount}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 日別集計テーブル */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                📅 日別の食事・排泄サマリ
              </Text>
              {weeklyMealExcretionByDay.map((d) => (
                <View
                  key={d.date.toISOString()}
                  style={[styles.historyRow, { borderTopColor: theme.border }]}
                >
                  <Text style={[styles.historyDate, { color: theme.textPrimary }]}>
                    {formatMonthDayWithDow(d.date)}
                  </Text>
                  <Text
                    style={[styles.historyNote, { color: theme.textSecondary }]}
                  >
                    食事・授乳: {d.mealCount}回 (ミルク計 {d.milkTotalMl}ml)
                  </Text>
                  <Text
                    style={[
                      styles.historyAmount,
                      { color: theme.isDark ? '#38BDF8' : '#0284C7' },
                    ]}
                  >
                    排泄 {d.excretionCount}回
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ================================================================ */}
        {/* タブ3: 睡眠の開始・終了 週単位タイムバーグラフ                    */}
        {/* ================================================================ */}
        {subTab === 'sleep' ? (
          <View>
            {/* 週ナビゲーション */}
            <View
              style={[
                styles.weekNavRow,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.weekNavBtn,
                  { backgroundColor: theme.bgElevated },
                ]}
                onPress={() => setWeekOffset((w) => w - 1)}
              >
                <Text style={[styles.weekNavBtnText, { color: theme.textPrimary }]}>
                  ◀ 前の7日間
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setWeekOffset(0)}>
                <Text style={[styles.weekRangeTitle, { color: theme.textPrimary }]}>
                  {formatMonthDayWithDow(weekDays[0])} 〜{' '}
                  {formatMonthDayWithDow(weekDays[6])}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.weekNavBtn,
                  { backgroundColor: theme.bgElevated },
                ]}
                onPress={() => setWeekOffset((w) => w + 1)}
              >
                <Text style={[styles.weekNavBtnText, { color: theme.textPrimary }]}>
                  次の7日間 ▶
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    🌙 週間睡眠リズム（開始〜終了時刻バー）
                  </Text>
                  <Text
                    style={[styles.cardSubtitle, { color: theme.textSecondary }]}
                  >
                    週平均睡眠時間（7日間按分）: 1日あたり{' '}
                    {formatMinutesToHoursMinutes(weeklyAverageSleepMinutes)}
                  </Text>
                </View>
                {canWrite ? (
                  <TouchableOpacity
                    style={[
                      styles.quickRecordButton,
                      { backgroundColor: '#6366F1' },
                    ]}
                    onPress={() => onOpenCreateModal(RecordCategory.SLEEP)}
                  >
                    <Text style={styles.quickRecordButtonText}>＋ 睡眠を記録</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* 24時間 × 7日間 睡眠バーチャート */}
              <View
                style={[
                  styles.timetableContainer,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.chartCanvasBg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.timeAxisCol,
                    {
                      borderRightColor: theme.border,
                      backgroundColor: theme.bgElevated,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dayHeaderSpacer,
                      { borderBottomColor: theme.border },
                    ]}
                  />
                  <View style={styles.timeAxisBody}>
                    {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hr) => (
                      <Text
                        key={hr}
                        style={[
                          styles.timeAxisLabel,
                          {
                            top: `${(hr / 24) * 100}%`,
                            color: theme.chartAxisText,
                          },
                        ]}
                      >
                        {hr}:00
                      </Text>
                    ))}
                  </View>
                </View>

                {weeklySleepByDay.map((dayCol) => (
                  <View
                    key={dayCol.date.toISOString()}
                    style={[
                      styles.dayColumn,
                      { borderRightColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.dayHeaderBox,
                        {
                          borderBottomColor: theme.border,
                          backgroundColor: theme.bgElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayHeaderDate,
                          { color: theme.textPrimary },
                        ]}
                      >
                        {formatMonthDay(dayCol.date)}
                      </Text>
                      <Text
                        style={[
                          styles.dayHeaderDow,
                          { color: theme.textSecondary },
                        ]}
                      >
                        ({WEEKDAY_NAMES[dayCol.date.getDay()]})
                      </Text>
                    </View>

                    <View style={styles.dayTimelineTrack}>
                      {[0.25, 0.5, 0.75].map((r) => (
                        <View
                          key={String(r)}
                          style={[
                            styles.trackGridLine,
                            {
                              top: `${r * 100}%`,
                              backgroundColor: theme.chartGridLine,
                            },
                          ]}
                        />
                      ))}

                      {dayCol.blocks.map((blk) => {
                        const topPct = (blk.startMinute / 1440) * 100;
                        const heightPct = Math.max(
                          2.5,
                          ((blk.endMinute - blk.startMinute) / 1440) * 100
                        );
                        return (
                          <View
                            key={blk.id}
                            style={[
                              styles.sleepBlockBar,
                              {
                                top: `${topPct}%`,
                                height: `${heightPct}%`,
                              },
                              blk.isOngoing && {
                                backgroundColor: theme.isDark
                                  ? 'rgba(99, 102, 241, 0.45)'
                                  : 'rgba(99, 102, 241, 0.25)',
                                borderWidth: 1.5,
                                borderColor: '#6366F1',
                                borderStyle: 'dashed',
                              },
                            ]}
                          >
                            {heightPct >= 8 ? (
                              <Text
                                style={[
                                  styles.sleepBlockText,
                                  blk.isOngoing && {
                                    color: theme.isDark ? '#E0E7FF' : '#312E81',
                                  },
                                ]}
                              >
                                {blk.isOngoing
                                  ? '睡眠中'
                                  : formatMinutesToHoursMinutes(
                                      blk.durationMinutes
                                    )}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <View
                      style={[
                        styles.dayFooterBox,
                        {
                          borderTopColor: theme.border,
                          backgroundColor: theme.bgElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayFooterStat,
                          {
                            color: theme.isDark ? '#A5B4FC' : '#4338CA',
                            fontWeight: '800',
                          },
                        ]}
                      >
                        {formatMinutesToHoursMinutes(dayCol.totalMinutes)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 睡眠時間帯の内訳リスト */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                🛌 日別の睡眠開始・終了時刻一覧
              </Text>
              {weeklySleepByDay.map((d) => (
                <View
                  key={d.date.toISOString()}
                  style={[styles.historyRow, { borderTopColor: theme.border }]}
                >
                  <Text style={[styles.historyDate, { color: theme.textPrimary }]}>
                    {formatMonthDayWithDow(d.date)}
                  </Text>
                  <Text
                    style={[styles.historyNote, { color: theme.textSecondary }]}
                  >
                    {d.blocks.length > 0
                      ? d.blocks.map((b) => b.label).join(' / ')
                      : '記録なし'}
                  </Text>
                  <Text
                    style={[
                      styles.historyAmount,
                      { color: theme.isDark ? '#818CF8' : '#4F46E5' },
                    ]}
                  >
                    計 {formatMinutesToHoursMinutes(d.totalMinutes)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ================================================================ */}
        {/* タブ4: 体温の折れ線グラフ                                        */}
        {/* ================================================================ */}
        {subTab === 'temperature' ? (
          <View>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                    🌡️ 体温推移グラフ（折れ線）
                  </Text>
                  <Text
                    style={[styles.cardSubtitle, { color: theme.textSecondary }]}
                  >
                    赤破線は発熱目安ライン（37.5℃）を表します
                  </Text>
                </View>
                {canWrite ? (
                  <TouchableOpacity
                    style={[
                      styles.quickRecordButton,
                      { backgroundColor: '#EF4444' },
                    ]}
                    onPress={() => onOpenCreateModal(RecordCategory.BODY_TEMP)}
                  >
                    <Text style={styles.quickRecordButtonText}>＋ 体温を記録</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {bodyTempPoints.length > 0 ? (
                <PolylineChart
                  points={bodyTempPoints}
                  minY={35.5}
                  maxY={39.5}
                  unit="℃"
                  lineColor="#F97316"
                  referenceLineValue={37.5}
                  referenceLineLabel="37.5℃ 発熱目安"
                />
              ) : (
                <View
                  style={[
                    styles.emptyBox,
                    {
                      backgroundColor: theme.bgElevated,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[styles.emptyBoxText, { color: theme.textSecondary }]}
                  >
                    まだ体温の記録がありません。「＋ 体温を記録」から検温結果を追加してください。
                  </Text>
                </View>
              )}

              {bodyTempRecords.length > 0 ? (
                <View style={styles.statSummaryRow}>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      最新の体温
                    </Text>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color:
                            (bodyTempRecords[bodyTempRecords.length - 1]
                              .amount ?? 36.5) >= 37.5
                              ? theme.dangerText
                              : theme.textPrimary,
                        },
                      ]}
                    >
                      {bodyTempRecords[bodyTempRecords.length - 1].amount} ℃
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      期間最高
                    </Text>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      {Math.max(
                        ...bodyTempRecords.map((r) => r.amount ?? 36.5)
                      ).toFixed(1)}{' '}
                      ℃
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.bgElevated,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statLabel, { color: theme.textSecondary }]}
                    >
                      平均平熱目安
                    </Text>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      {(
                        bodyTempRecords.reduce(
                          (acc, r) => acc + (r.amount ?? 36.5),
                          0
                        ) / bodyTempRecords.length
                      ).toFixed(1)}{' '}
                      ℃
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* 検温ログ一覧 */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                📋 検温履歴一覧
              </Text>
              {bodyTempRecords
                .slice()
                .reverse()
                .map((rec) => {
                  const isFever = (rec.amount ?? 0) >= 37.5;
                  return (
                    <View
                      key={rec.id}
                      style={[
                        styles.historyRow,
                        { borderTopColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[styles.historyDate, { color: theme.textPrimary }]}
                      >
                        {formatMonthDayWithDow(rec.startTime)}{' '}
                        {formatHm(rec.startTime)}
                      </Text>
                      <Text
                        style={[
                          styles.historyNote,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {rec.parsedMetadata.note ?? '検温'}
                      </Text>
                      <Text
                        style={[
                          styles.historyAmount,
                          {
                            color: isFever
                              ? theme.dangerText
                              : theme.textPrimary,
                          },
                        ]}
                      >
                        {isFever ? '⚠️ ' : ''}
                        {rec.amount} ℃
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export const AnalyticsScreen = withObservables(
  ['childId'],
  ({ childId }: AnalyticsScreenExternalProps) => ({
    child: collections.children.findAndObserve(childId),
    records: collections.records
      .query(Q.where('child_id', childId), Q.sortBy('start_time', Q.asc))
      .observeWithColumns([
        'category',
        'start_time',
        'end_time',
        'amount',
        'metadata',
      ]),
  })
)(RawAnalyticsScreen);

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
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sampleButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sampleButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  subTabButtonActive: {
    backgroundColor: '#0F172A',
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  metricSelectorRow: {
    gap: 8,
    paddingBottom: 12,
  },
  metricChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  metricChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  quickRecordButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickRecordButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chartWrapper: {
    marginTop: 6,
  },
  chartMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisColumn: {
    width: 38,
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 6,
    alignItems: 'flex-end',
  },
  yAxisText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  plotCanvas: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  referenceBandBar: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1,
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderColor: '#EF4444',
    borderStyle: 'dashed',
  },
  referenceLineText: {
    position: 'absolute',
    right: 6,
    top: -16,
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  pointValueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 42,
    paddingRight: 8,
    marginTop: 6,
  },
  xAxisText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  unitCaption: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 2,
  },
  statSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    minWidth: 92,
  },
  historyNote: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 8,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  weekNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  weekRangeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  legendItem: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  timetableContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  timeAxisCol: {
    width: 36,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  dayHeaderSpacer: {
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  timeAxisBody: {
    height: 360,
    position: 'relative',
  },
  timeAxisLabel: {
    position: 'absolute',
    right: 4,
    fontSize: 9,
    color: '#64748B',
    transform: [{ translateY: -6 }],
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  dayHeaderBox: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dayHeaderDate: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  dayHeaderDow: {
    fontSize: 10,
    color: '#64748B',
  },
  dayTimelineTrack: {
    height: 360,
    position: 'relative',
  },
  trackGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  eventMarkerBadge: {
    position: 'absolute',
    minHeight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  eventMarkerIcon: {
    fontSize: 10,
  },
  eventMarkerIconCompact: {
    fontSize: 9,
  },
  eventMarkerTime: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 2,
  },
  eventMarkerTimeCompact: {
    fontSize: 7.5,
    marginLeft: 1,
  },
  sleepBlockBar: {
    position: 'absolute',
    left: 6,
    right: 6,
    backgroundColor: '#6366F1',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  sleepBlockText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dayFooterBox: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dayFooterStat: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  emptyBoxText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default AnalyticsScreen;
