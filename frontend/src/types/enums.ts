/**
 * バックエンド (app/models/enums.py) と1対1で対応するEnum・型定義・バリデーションルール
 */

export const RelationshipType = {
  FATHER: 'father',
  MOTHER: 'mother',
  GRANDFATHER: 'grandfather',
  GRANDMOTHER: 'grandmother',
  BABYSITTER: 'babysitter',
  OTHER: 'other',
} as const;

export type RelationshipType =
  (typeof RelationshipType)[keyof typeof RelationshipType];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  [RelationshipType.FATHER]: 'パパ (父親)',
  [RelationshipType.MOTHER]: 'ママ (母親)',
  [RelationshipType.GRANDFATHER]: 'おじいちゃん (祖父)',
  [RelationshipType.GRANDMOTHER]: 'おばあちゃん (祖母)',
  [RelationshipType.BABYSITTER]: 'ベビーシッター',
  [RelationshipType.OTHER]: 'その他',
};

export const UserRole = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '管理者 (全操作可)',
  [UserRole.EDITOR]: '編集者 (記録・編集可)',
  [UserRole.VIEWER]: '閲覧者 (閲覧のみ)',
};

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  UNSPECIFIED: 'unspecified',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: '男の子',
  [Gender.FEMALE]: '女の子',
  [Gender.UNSPECIFIED]: '未指定',
};

export const RecordCategory = {
  MILK: 'milk',
  BABY_FOOD: 'baby_food',
  MEAL: 'meal',
  SLEEP: 'sleep',
  EXCRETION: 'excretion',
  BODY_TEMP: 'body_temp',
  HEIGHT: 'height',
  WEIGHT: 'weight',
  HEAD_CIRCUMFERENCE: 'head_circumference',
  CHEST_CIRCUMFERENCE: 'chest_circumference',
  FOOT_SIZE: 'foot_size',
  CUSTOM: 'custom',
} as const;

export type RecordCategory =
  (typeof RecordCategory)[keyof typeof RecordCategory];

/**
 * PRD 6.4 準拠: 'aftermeal' | 'intervalhours' | 'specifictime'
 */
export const FrequencyType = {
  AFTERMEAL: 'aftermeal',
  INTERVALHOURS: 'intervalhours',
  SPECIFICTIME: 'specifictime',
  // Legacy aliases mapped to the same canonical values
  AFTER_MEAL: 'aftermeal',
  INTERVAL_HOURS: 'intervalhours',
  SPECIFIC_TIME: 'specifictime',
} as const;

export type FrequencyType =
  (typeof FrequencyType)[keyof typeof FrequencyType];

/**
 * PRD 6.5 準拠: 'sleepstart' | 'sleepend' | 'rollover' | 'crawl' | 'standup'
 */
export const CameraEventType = {
  SLEEPSTART: 'sleepstart',
  SLEEPEND: 'sleepend',
  ROLLOVER: 'rollover',
  CRAWL: 'crawl',
  STANDUP: 'standup',
  // Legacy aliases mapped to the same canonical values
  SLEEP_START: 'sleepstart',
  SLEEP_END: 'sleepend',
} as const;

export type CameraEventType =
  (typeof CameraEventType)[keyof typeof CameraEventType];

/**
 * PRD 4.3.A カテゴリ別数値許容レンジ
 */
export const AMOUNT_RANGES: Partial<
  Record<RecordCategory, { min: number; max: number; unitLabel: string }>
> = {
  [RecordCategory.MILK]: { min: 0.0, max: 2000.0, unitLabel: 'ml / g' },
  [RecordCategory.BABY_FOOD]: { min: 0.0, max: 2000.0, unitLabel: 'g / ml' },
  [RecordCategory.MEAL]: { min: 0.0, max: 2000.0, unitLabel: 'g / ml' },
  [RecordCategory.BODY_TEMP]: { min: 32.0, max: 43.0, unitLabel: '℃' },
  [RecordCategory.HEIGHT]: { min: 20.0, max: 220.0, unitLabel: 'cm' },
  [RecordCategory.WEIGHT]: { min: 0.3, max: 150.0, unitLabel: 'kg' },
  [RecordCategory.HEAD_CIRCUMFERENCE]: { min: 20.0, max: 120.0, unitLabel: 'cm' },
  [RecordCategory.CHEST_CIRCUMFERENCE]: { min: 20.0, max: 120.0, unitLabel: 'cm' },
  [RecordCategory.FOOT_SIZE]: { min: 5.0, max: 35.0, unitLabel: 'cm' },
};

export interface RecordFormValidationResult {
  isValid: boolean;
  errorMessage: string | null;
  parsedStartTime: Date | null;
  parsedEndTime: Date | null;
  parsedAmount: number | null;
}

/**
 * PRD 4.3.A に基づくフロントエンド入力値バリデーション
 * - 壊れた日時文字列を無言で `new Date()` に置き換えず、厳密に検証する
 * - `end_time >= start_time` およびカテゴリ別 `amount` レンジを検証する
 */
export function validateRecordFormInput(params: {
  category: RecordCategory;
  hasAmount: boolean;
  hasDuration: boolean;
  amountInput: string;
  durationMinutesInput: string;
  startOffsetMinutes: number | null;
  customDateInput: string;
  customTimeInput: string;
  nowMs?: number;
}): RecordFormValidationResult {
  const {
    category,
    hasAmount,
    hasDuration,
    amountInput,
    durationMinutesInput,
    startOffsetMinutes,
    customDateInput,
    customTimeInput,
    nowMs = Date.now(),
  } = params;

  let startTime: Date;
  if (startOffsetMinutes !== null) {
    startTime = new Date(nowMs - startOffsetMinutes * 60 * 1000);
  } else {
    const dateTrimmed = customDateInput.trim();
    const timeTrimmed = customTimeInput.trim();
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTrimmed);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeTrimmed);

    if (!dateMatch) {
      return {
        isValid: false,
        errorMessage: '日付は YYYY-MM-DD 形式で正しく入力してください',
        parsedStartTime: null,
        parsedEndTime: null,
        parsedAmount: null,
      };
    }
    if (!timeMatch) {
      return {
        isValid: false,
        errorMessage: '時刻は HH:MM 形式（00:00〜23:59）で正しく入力してください',
        parsedStartTime: null,
        parsedEndTime: null,
        parsedAmount: null,
      };
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return {
        isValid: false,
        errorMessage: '存在しない日付または時刻が指定されています',
        parsedStartTime: null,
        parsedEndTime: null,
        parsedAmount: null,
      };
    }

    const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return {
        isValid: false,
        errorMessage: '存在しない日付（月末日外など）が指定されています',
        parsedStartTime: null,
        parsedEndTime: null,
        parsedAmount: null,
      };
    }
    startTime = candidate;
  }

  let endTime: Date | null = null;
  if (hasDuration && durationMinutesInput.trim() !== '') {
    const durNum = Number(durationMinutesInput.trim());
    if (Number.isNaN(durNum) || !Number.isFinite(durNum) || durNum < 0) {
      return {
        isValid: false,
        errorMessage: '所要時間（分）には0以上の数値を入力してください (`end_time >= start_time`)',
        parsedStartTime: startTime,
        parsedEndTime: null,
        parsedAmount: null,
      };
    }
    if (durNum > 0) {
      endTime = new Date(startTime.getTime() + durNum * 60 * 1000);
    }
  }

  let parsedAmount: number | null = null;
  if (hasAmount) {
    const trimmedAmount = amountInput.trim();
    const rangeRule = AMOUNT_RANGES[category];
    if (trimmedAmount !== '') {
      const num = Number(trimmedAmount);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        return {
          isValid: false,
          errorMessage: '数値・量には有効な数値を入力してください',
          parsedStartTime: startTime,
          parsedEndTime: endTime,
          parsedAmount: null,
        };
      }
      if (rangeRule && (num < rangeRule.min || num > rangeRule.max)) {
        return {
          isValid: false,
          errorMessage: `${RECORD_CATEGORY_CONFIGS[category].label}は ${rangeRule.min} 〜 ${rangeRule.max} (${rangeRule.unitLabel}) の範囲で入力してください`,
          parsedStartTime: startTime,
          parsedEndTime: endTime,
          parsedAmount: null,
        };
      }
      parsedAmount = num;
    } else if (rangeRule && category !== RecordCategory.CUSTOM) {
      // 身体測定・体温・ミルク等の数値カテゴリで未入力の場合は無効とする
      return {
        isValid: false,
        errorMessage: `${RECORD_CATEGORY_CONFIGS[category].label}の数値を入力してください（${rangeRule.min}〜${rangeRule.max} ${rangeRule.unitLabel}）`,
        parsedStartTime: startTime,
        parsedEndTime: endTime,
        parsedAmount: null,
      };
    }
  }

  return {
    isValid: true,
    errorMessage: null,
    parsedStartTime: startTime,
    parsedEndTime: endTime,
    parsedAmount,
  };
}

/**
 * UI表示用のカテゴリ設定マスタ
 */
export interface CategoryConfig {
  category: RecordCategory;
  label: string;
  icon: string;
  defaultUnit?: string;
  hasDuration?: boolean;
  hasAmount?: boolean;
  accentColor: string;
}

export const RECORD_CATEGORY_CONFIGS: Record<RecordCategory, CategoryConfig> = {
  [RecordCategory.MILK]: {
    category: RecordCategory.MILK,
    label: 'ミルク・授乳',
    icon: '🍼',
    defaultUnit: 'ml',
    hasAmount: true,
    accentColor: '#FF8A65',
  },
  [RecordCategory.BABY_FOOD]: {
    category: RecordCategory.BABY_FOOD,
    label: '離乳食',
    icon: '🥣',
    defaultUnit: 'g',
    hasAmount: true,
    accentColor: '#FFB74D',
  },
  [RecordCategory.MEAL]: {
    category: RecordCategory.MEAL,
    label: '食事',
    icon: '🍽️',
    defaultUnit: 'g',
    hasAmount: true,
    accentColor: '#AED581',
  },
  [RecordCategory.SLEEP]: {
    category: RecordCategory.SLEEP,
    label: '睡眠',
    icon: '🌙',
    hasDuration: true,
    accentColor: '#7986CB',
  },
  [RecordCategory.EXCRETION]: {
    category: RecordCategory.EXCRETION,
    label: '排泄',
    icon: '🧷',
    accentColor: '#4DD0E1',
  },
  [RecordCategory.BODY_TEMP]: {
    category: RecordCategory.BODY_TEMP,
    label: '体温',
    icon: '🌡️',
    defaultUnit: '℃',
    hasAmount: true,
    accentColor: '#E57373',
  },
  [RecordCategory.HEIGHT]: {
    category: RecordCategory.HEIGHT,
    label: '身長',
    icon: '📏',
    defaultUnit: 'cm',
    hasAmount: true,
    accentColor: '#81C784',
  },
  [RecordCategory.WEIGHT]: {
    category: RecordCategory.WEIGHT,
    label: '体重',
    icon: '⚖️',
    defaultUnit: 'kg',
    hasAmount: true,
    accentColor: '#64B5F6',
  },
  [RecordCategory.HEAD_CIRCUMFERENCE]: {
    category: RecordCategory.HEAD_CIRCUMFERENCE,
    label: '頭囲',
    icon: '🧢',
    defaultUnit: 'cm',
    hasAmount: true,
    accentColor: '#4DB6AC',
  },
  [RecordCategory.CHEST_CIRCUMFERENCE]: {
    category: RecordCategory.CHEST_CIRCUMFERENCE,
    label: '胸囲',
    icon: '👕',
    defaultUnit: 'cm',
    hasAmount: true,
    accentColor: '#9575CD',
  },
  [RecordCategory.FOOT_SIZE]: {
    category: RecordCategory.FOOT_SIZE,
    label: '足のサイズ',
    icon: '👟',
    defaultUnit: 'cm',
    hasAmount: true,
    accentColor: '#A1887F',
  },
  [RecordCategory.CUSTOM]: {
    category: RecordCategory.CUSTOM,
    label: 'その他',
    icon: '📝',
    hasAmount: true,
    accentColor: '#BA68C8',
  },
};
