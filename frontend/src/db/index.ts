import { Database } from '@nozbe/watermelondb';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';

import { createDatabaseAdapter } from './adapter';
import { kodomoTrackerSchema, TableName } from './schema';
import {
  modelClasses,
  User,
  Child,
  Record,
  Prescription,
  CameraEvent,
  NurseryMenu,
} from './models';

/**
 * バックエンド (FastAPI / PostgreSQL UUID型) と互換性のある UUID v4 ジェネレータを設定
 * オフラインで新規作成されたレコードの `id` もそのまま UUID として同期可能にする
 */
function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

setGenerator(generateUuidV4);

export const database = new Database({
  adapter: createDatabaseAdapter(),
  modelClasses,
});

/**
 * 型付きコレクション取得ヘルパー
 */
export const collections = {
  users: database.get<User>(TableName.USERS),
  children: database.get<Child>(TableName.CHILDREN),
  records: database.get<Record>(TableName.RECORDS),
  prescriptions: database.get<Prescription>(TableName.PRESCRIPTIONS),
  cameraEvents: database.get<CameraEvent>(TableName.CAMERA_EVENTS),
  nurseryMenus: database.get<NurseryMenu>(TableName.NURSERY_MENUS),
};

export {
  kodomoTrackerSchema,
  TableName,
  User,
  Child,
  Record,
  Prescription,
  CameraEvent,
  NurseryMenu,
};
export default database;
