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
  ],
});

export default kodomoTrackerMigrations;
