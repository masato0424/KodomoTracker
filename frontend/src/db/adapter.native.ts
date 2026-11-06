import { Platform } from 'react-native';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { kodomoTrackerSchema } from './schema';
import { kodomoTrackerMigrations } from './migrations';

/**
 * iOS / Android ネイティブ環境用アダプタ (SQLite + JSI)
 * Metro Bundler は Platform=ios / android の際に自動的にこの `adapter.native.ts` を解決する
 */
export function createDatabaseAdapter() {
  return new SQLiteAdapter({
    schema: kodomoTrackerSchema,
    migrations: kodomoTrackerMigrations,
    dbName: 'kodomo_tracker_db',
    jsi: Platform.OS === 'ios' || Platform.OS === 'android',
    onSetUpError: (error) => {
      console.error('[WatermelonDB/Native] Database setup failed:', error);
    },
  });
}
