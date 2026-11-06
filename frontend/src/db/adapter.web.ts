import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { kodomoTrackerSchema } from './schema';
import { kodomoTrackerMigrations } from './migrations';

/**
 * Web プレビュー環境用アダプタ (IndexedDB 永続化)
 * Metro Bundler は Platform=web の際に自動的にこの `adapter.web.ts` を解決する
 */
export function createDatabaseAdapter() {
  return new LokiJSAdapter({
    schema: kodomoTrackerSchema,
    migrations: kodomoTrackerMigrations,
    dbName: 'kodomo_tracker_db',
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: (error) => {
      console.error('[WatermelonDB/Web] Database setup failed:', error);
    },
  });
}
