import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const TableName = {
  USERS: 'users',
  CHILDREN: 'children',
  RECORDS: 'records',
  PRESCRIPTIONS: 'prescriptions',
  CAMERA_EVENTS: 'camera_events',
  NURSERY_MENUS: 'nursery_menus',
} as const;

export type TableName = (typeof TableName)[keyof typeof TableName];

/**
 * KodomoTracker WatermelonDB スキーマ定義
 *
 * 設計方針:
 * - FastAPI (PostgreSQL) 側の6テーブルと1対1で対応
 * - WatermelonDBの標準 `id` カラムにバックエンドのUUID文字列を保持してシームレスに同期
 * - PostgreSQLの `JSONB` カラム (`records.metadata`, `prescriptions.schedule_details`, `nursery_menus.menu_details`) は
 *   WatermelonDB (SQLite) 上では `string` 型（JSON文字列）として保存
 * - `DateTime(timezone=True)` カラムはエポックミリ秒 (`number`) として保存し `@date` デコレータで `Date` 変換
 * - `Date` カラム (`birth_date`, `start_date`, `target_date`) は ISO 8601 日付文字列 (`YYYY-MM-DD`) として保存
 */
export const kodomoTrackerSchema = appSchema({
  version: 3,
  tables: [
    // 1. 家族・関係者アカウント (users)
    tableSchema({
      name: TableName.USERS,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'relationship', type: 'string' }, // father | mother | grandfather | grandmother | babysitter | other
        { name: 'role', type: 'string' }, // admin | editor | viewer
        { name: 'theme_mode', type: 'string', isOptional: true }, // light | dark
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),

    // 2. 子ども情報 (children)
    tableSchema({
      name: TableName.CHILDREN,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'gender', type: 'string' }, // male | female | unspecified
        { name: 'birth_date', type: 'string' }, // YYYY-MM-DD
        { name: 'color_theme', type: 'string', isOptional: true }, // blue | pink | emerald | orange | purple | teal
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),

    // 3. 統合成長・生活ログ (records)
    tableSchema({
      name: TableName.RECORDS,
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'recorded_by', type: 'string', isOptional: true, isIndexed: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'start_time', type: 'number', isIndexed: true }, // Epoch ms
        { name: 'end_time', type: 'number', isOptional: true }, // Epoch ms
        { name: 'amount', type: 'number', isOptional: true },
        // バックエンドの JSONB カラムを JSON 文字列(string)として保存
        { name: 'metadata', type: 'string' },
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),

    // 4. 処方箋・服薬マスタ (prescriptions)
    tableSchema({
      name: TableName.PRESCRIPTIONS,
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'medicine_name', type: 'string' },
        { name: 'dosage_per_time', type: 'number' },
        { name: 'frequency_type', type: 'string' }, // aftermeal | intervalhours | specifictime
        { name: 'days', type: 'number' },
        { name: 'start_date', type: 'string' }, // YYYY-MM-DD
        { name: 'schedule_details', type: 'string', isOptional: true }, // JSON string
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),

    // 5. エッジAIからの受信ログ (camera_events)
    tableSchema({
      name: TableName.CAMERA_EVENTS,
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'event_type', type: 'string' }, // sleepstart | sleepend | rollover | crawl | standup
        { name: 'confidence', type: 'number' },
        { name: 'detected_at', type: 'number', isIndexed: true }, // Epoch ms
        { name: 'linked_record_id', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),

    // 6. 保育園・学校献立データ (nursery_menus)
    tableSchema({
      name: TableName.NURSERY_MENUS,
      columns: [
        { name: 'target_date', type: 'string', isIndexed: true }, // YYYY-MM-DD
        // バックエンドの JSONB カラムを JSON 文字列(string)として保存
        { name: 'menu_details', type: 'string' },
        { name: 'updated_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});

export default kodomoTrackerSchema;
