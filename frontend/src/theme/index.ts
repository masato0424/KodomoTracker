import React, { createContext, useContext } from 'react';

/**
 * 子どもごとに設定可能なカラーテーマ識別子
 */
export const ChildColorTheme = {
  BLUE: 'blue',
  PINK: 'pink',
  EMERALD: 'emerald',
  ORANGE: 'orange',
  PURPLE: 'purple',
  TEAL: 'teal',
} as const;

export type ChildColorTheme =
  (typeof ChildColorTheme)[keyof typeof ChildColorTheme];

/**
 * ユーザーごとに設定可能な画面表示モード（ライト / ダーク）
 */
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  [ThemeMode.LIGHT]: '☀️ ライトモード',
  [ThemeMode.DARK]: '🌙 ダークモード',
};

export interface ChildColorPalette {
  key: ChildColorTheme;
  label: string;
  icon: string;
  /** カラーチップ表示用の代表色 */
  swatch: string;
  /** ボタン背景色（白文字 #FFFFFF とのコントラスト比 4.5:1 以上を保証） */
  buttonBg: string;
  /** ライトモード時の文字・アイコン・強調アクセント色 */
  lightAccent: string;
  /** ライトモード時の淡い背景色（バッジ・選択行） */
  lightSoftBg: string;
  /** ライトモード時の画面全体ベース背景色 */
  lightScreenBg: string;
  /** ライトモード時の境界線色 */
  lightBorder: string;
  /** ダークモード時の文字・アイコン・強調アクセント色（暗い背景上で視認性の高い明度） */
  darkAccent: string;
  /** ダークモード時の淡い背景色（バッジ・選択行） */
  darkSoftBg: string;
  /** ダークモード時の境界線色 */
  darkBorder: string;
}

export const CHILD_COLOR_PALETTES: Record<ChildColorTheme, ChildColorPalette> =
  {
    [ChildColorTheme.BLUE]: {
      key: ChildColorTheme.BLUE,
      label: 'オーシャンブルー',
      icon: '💙',
      swatch: '#2563EB',
      buttonBg: '#2563EB',
      lightAccent: '#1D4ED8',
      lightSoftBg: '#EFF6FF',
      lightScreenBg: '#F1F6FD',
      lightBorder: '#93C5FD',
      darkAccent: '#60A5FA',
      darkSoftBg: '#1E3A5F',
      darkBorder: '#3B82F6',
    },
    [ChildColorTheme.PINK]: {
      key: ChildColorTheme.PINK,
      label: 'さくらピンク',
      icon: '🩷',
      swatch: '#DB2777',
      buttonBg: '#DB2777',
      lightAccent: '#BE185D',
      lightSoftBg: '#FDF2F8',
      lightScreenBg: '#FCF2F7',
      lightBorder: '#F9A8D4',
      darkAccent: '#F472B6',
      darkSoftBg: '#4A1D35',
      darkBorder: '#EC4899',
    },
    [ChildColorTheme.EMERALD]: {
      key: ChildColorTheme.EMERALD,
      label: 'ミントグリーン',
      icon: '💚',
      swatch: '#059669',
      buttonBg: '#059669',
      lightAccent: '#047857',
      lightSoftBg: '#ECFDF5',
      lightScreenBg: '#F0F9F5',
      lightBorder: '#6EE7B7',
      darkAccent: '#34D399',
      darkSoftBg: '#133E35',
      darkBorder: '#10B981',
    },
    [ChildColorTheme.ORANGE]: {
      key: ChildColorTheme.ORANGE,
      label: 'サンシャインオレンジ',
      icon: '🧡',
      swatch: '#EA580C',
      buttonBg: '#EA580C',
      lightAccent: '#C2410C',
      lightSoftBg: '#FFF7ED',
      lightScreenBg: '#FCF6F0',
      lightBorder: '#FDBA74',
      darkAccent: '#FB923C',
      darkSoftBg: '#482312',
      darkBorder: '#F97316',
    },
    [ChildColorTheme.PURPLE]: {
      key: ChildColorTheme.PURPLE,
      label: 'ラベンダーパープル',
      icon: '💜',
      swatch: '#7C3AED',
      buttonBg: '#7C3AED',
      lightAccent: '#6D28D9',
      lightSoftBg: '#F5F3FF',
      lightScreenBg: '#F5F2FC',
      lightBorder: '#C4B5FD',
      darkAccent: '#A78BFA',
      darkSoftBg: '#2E1D59',
      darkBorder: '#8B5CF6',
    },
    [ChildColorTheme.TEAL]: {
      key: ChildColorTheme.TEAL,
      label: 'アクアティール',
      icon: '🩵',
      swatch: '#0D9488',
      buttonBg: '#0D9488',
      lightAccent: '#0F766E',
      lightSoftBg: '#F0FDFA',
      lightScreenBg: '#EFF9F8',
      lightBorder: '#5EEAD4',
      darkAccent: '#2DD4BF',
      darkSoftBg: '#13403D',
      darkBorder: '#14B8A6',
    },
  };

export const CHILD_COLOR_THEME_LIST: ChildColorPalette[] =
  Object.values(CHILD_COLOR_PALETTES);

export function normalizeChildColorTheme(
  value?: string | null
): ChildColorTheme {
  if (value && value in CHILD_COLOR_PALETTES) {
    return value as ChildColorTheme;
  }
  return ChildColorTheme.BLUE;
}

export function normalizeThemeMode(value?: string | null): ThemeMode {
  if (value === ThemeMode.DARK || value === ThemeMode.LIGHT) {
    return value;
  }
  return ThemeMode.LIGHT;
}

/**
 * アプリ全体に適用される解決済みテーマオブジェクト
 * 子どものカラーテーマとユーザーのライト/ダークモードを統合し、
 * 文字・アイコン・グラフの視認性（高コントラスト）を常に担保する。
 */
export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  colorTheme: ChildColorTheme;
  palette: ChildColorPalette;

  // 背景色
  bgScreen: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  bgHeader: string;

  // テキスト色
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // アクセント・テーマ色（子どものカラーテーマ連動）
  primary: string;
  primaryButtonBg: string;
  primarySoftBg: string;
  primaryBorder: string;

  // 削除・キャンセル用（要件5：一律赤文字で視認性高く表示）
  dangerText: string;
  dangerSoftBg: string;
  dangerBorder: string;

  // 境界線・グラフ描画用
  border: string;
  borderStrong: string;
  chartCanvasBg: string;
  chartGridLine: string;
  chartAxisText: string;
}

export function buildAppTheme(
  colorThemeInput?: string | null,
  modeInput?: string | null
): AppTheme {
  const colorTheme = normalizeChildColorTheme(colorThemeInput);
  const mode = normalizeThemeMode(modeInput);
  const isDark = mode === ThemeMode.DARK;
  const palette = CHILD_COLOR_PALETTES[colorTheme];

  if (isDark) {
    return {
      mode,
      isDark: true,
      colorTheme,
      palette,

      bgScreen: '#0F172A',
      bgCard: '#1E293B',
      bgElevated: '#334155',
      bgInput: '#0F172A',
      bgHeader: '#1E293B',

      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      textOnPrimary: '#FFFFFF',

      primary: palette.darkAccent,
      primaryButtonBg: palette.buttonBg,
      primarySoftBg: palette.darkSoftBg,
      primaryBorder: palette.darkBorder,

      dangerText: '#F87171',
      dangerSoftBg: '#3B181E',
      dangerBorder: '#7F1D1D',

      border: '#334155',
      borderStrong: '#475569',
      chartCanvasBg: '#0F172A',
      chartGridLine: '#334155',
      chartAxisText: '#CBD5E1',
    };
  }

  return {
    mode,
    isDark: false,
    colorTheme,
    palette,

    bgScreen: palette.lightScreenBg,
    bgCard: '#FFFFFF',
    bgElevated: '#F8FAFC',
    bgInput: '#FFFFFF',
    bgHeader: '#FFFFFF',

    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textOnPrimary: '#FFFFFF',

    primary: palette.lightAccent,
    primaryButtonBg: palette.buttonBg,
    primarySoftBg: palette.lightSoftBg,
    primaryBorder: palette.lightBorder,

    dangerText: '#DC2626',
    dangerSoftBg: '#FEF2F2',
    dangerBorder: '#FECACA',

    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    chartCanvasBg: '#F8FAFC',
    chartGridLine: '#E2E8F0',
    chartAxisText: '#475569',
  };
}

const defaultTheme = buildAppTheme(ChildColorTheme.BLUE, ThemeMode.LIGHT);

export const ThemeContext = createContext<AppTheme>(defaultTheme);

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
