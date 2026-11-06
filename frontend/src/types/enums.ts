/**
 * バックエンド (app/models/enums.py) と1対1で対応するEnum・型定義
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

export const FrequencyType = {
  AFTER_MEAL: 'after_meal',
  INTERVAL_HOURS: 'interval_hours',
  SPECIFIC_TIME: 'specific_time',
} as const;

export type FrequencyType =
  (typeof FrequencyType)[keyof typeof FrequencyType];

export const CameraEventType = {
  SLEEP_START: 'sleep_start',
  SLEEP_END: 'sleep_end',
  ROLLOVER: 'rollover',
} as const;

export type CameraEventType =
  (typeof CameraEventType)[keyof typeof CameraEventType];

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
