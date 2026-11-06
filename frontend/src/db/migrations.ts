import {
  addColumns,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

import { TableName } from './schema';

/**
 * WatermelonDB スキーママイグレーション定義
 * 将来的なスキーマバージョンアップ時にマイグレーションステップをここに追加する。
 */
export const kodomoTrackerMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: TableName.USERS,
          columns: [{ name: 'theme_mode', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: TableName.CHILDREN,
          columns: [{ name: 'color_theme', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: TableName.USERS,
          columns: [{ name: 'updated_at', type: 'number', isOptional: true }],
        }),
        addColumns({
          table: TableName.CHILDREN,
          columns: [{ name: 'updated_at', type: 'number', isOptional: true }],
        }),
        addColumns({
          table: TableName.RECORDS,
          columns: [{ name: 'updated_at', type: 'number', isOptional: true }],
        }),
        addColumns({
          table: TableName.PRESCRIPTIONS,
          columns: [
            { name: 'schedule_details', type: 'string', isOptional: true },
            { name: 'updated_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: TableName.CAMERA_EVENTS,
          columns: [
            { name: 'linked_record_id', type: 'string', isOptional: true },
            { name: 'updated_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: TableName.NURSERY_MENUS,
          columns: [{ name: 'updated_at', type: 'number', isOptional: true }],
        }),
      ],
    },
  ],
});

export default kodomoTrackerMigrations;
