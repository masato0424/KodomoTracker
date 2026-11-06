import { Database, Q } from '@nozbe/watermelondb';
import {
  synchronize,
  SyncDatabaseChangeSet,
  SyncPullArgs,
  SyncPullResult,
  SyncPushArgs,
} from '@nozbe/watermelondb/sync';

import defaultDatabase, { TableName, Record as RecordModel, NurseryMenu } from '../db';
import { apiClient, ApiError } from './api';

/**
 * FastAPI 側のエンドポイントパス定義
 * 外部キー制約の依存順（親テーブル → 子テーブル）に並べる
 */
const SYNC_TABLE_ORDER: TableName[] = [
  TableName.USERS,
  TableName.CHILDREN,
  TableName.RECORDS,
  TableName.PRESCRIPTIONS,
  TableName.CAMERA_EVENTS,
  TableName.NURSERY_MENUS,
];

const TABLE_ENDPOINTS: Record<TableName, string> = {
  [TableName.USERS]: '/users/',
  [TableName.CHILDREN]: '/children/',
  [TableName.RECORDS]: '/records/',
  [TableName.PRESCRIPTIONS]: '/prescriptions/',
  [TableName.CAMERA_EVENTS]: '/camera-events/',
  [TableName.NURSERY_MENUS]: '/nursery-menus/',
};

export type RawSyncRecord = Record<string, unknown> & { id: string };

/**
 * ISO 8601 日時文字列またはエポック数値を WatermelonDB 用のエポックミリ秒に変換
 */
function toEpochMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * エポックミリ秒を FastAPI (Pydantic datetime) 用の ISO 8601 文字列に変換
 */
function toIsoDateTime(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  return null;
}

/**
 * FastAPI から取得した JSON オブジェクトを WatermelonDB の RawRecord 形式へ変換
 * - JSONB カラム (`metadata`, `menu_details`) -> JSON 文字列 (`string`)
 * - DateTime カラム (`start_time`, `end_time`, `detected_at`) -> エポックミリ秒 (`number`)
 */
export function deserializeServerRecord(
  table: TableName,
  serverRecord: Record<string, unknown>
): RawSyncRecord {
  const id = String(serverRecord.id);

  switch (table) {
    case TableName.USERS:
      return {
        id,
        name: String(serverRecord.name ?? ''),
        relationship: String(serverRecord.relationship ?? 'other'),
        role: String(serverRecord.role ?? 'editor'),
        theme_mode:
          serverRecord.theme_mode !== undefined &&
          serverRecord.theme_mode !== null
            ? String(serverRecord.theme_mode)
            : 'light',
      };

    case TableName.CHILDREN:
      return {
        id,
        name: String(serverRecord.name ?? ''),
        gender: String(serverRecord.gender ?? 'unspecified'),
        birth_date: String(serverRecord.birth_date ?? ''),
        color_theme:
          serverRecord.color_theme !== undefined &&
          serverRecord.color_theme !== null
            ? String(serverRecord.color_theme)
            : 'blue',
      };

    case TableName.RECORDS:
      return {
        id,
        child_id: String(serverRecord.child_id ?? ''),
        recorded_by:
          serverRecord.recorded_by !== null && serverRecord.recorded_by !== undefined
            ? String(serverRecord.recorded_by)
            : null,
        category: String(serverRecord.category ?? 'custom'),
        start_time: toEpochMs(serverRecord.start_time) ?? Date.now(),
        end_time: toEpochMs(serverRecord.end_time),
        amount:
          typeof serverRecord.amount === 'number' ? serverRecord.amount : null,
        // JSONB オブジェクトを文字列(string)として保存
        metadata: RecordModel.serializeMetadata(
          serverRecord.metadata as Record<string, unknown> | string | null
        ),
      };

    case TableName.PRESCRIPTIONS:
      return {
        id,
        child_id: String(serverRecord.child_id ?? ''),
        medicine_name: String(serverRecord.medicine_name ?? ''),
        dosage_per_time: Number(serverRecord.dosage_per_time ?? 0),
        frequency_type: String(serverRecord.frequency_type ?? 'after_meal'),
        days: Number(serverRecord.days ?? 1),
        start_date: String(serverRecord.start_date ?? ''),
      };

    case TableName.CAMERA_EVENTS:
      return {
        id,
        child_id: String(serverRecord.child_id ?? ''),
        event_type: String(serverRecord.event_type ?? 'sleep_start'),
        confidence: Number(serverRecord.confidence ?? 0),
        detected_at: toEpochMs(serverRecord.detected_at) ?? Date.now(),
      };

    case TableName.NURSERY_MENUS:
      return {
        id,
        target_date: String(serverRecord.target_date ?? ''),
        // JSONB オブジェクトを文字列(string)として保存
        menu_details: NurseryMenu.serializeMenuDetails(
          serverRecord.menu_details as Record<string, unknown> | string | null
        ),
      };
  }
}

/**
 * WatermelonDB の RawRecord を FastAPI の Create / Update スキーマ形式へ変換
 * - JSON 文字列カラム (`metadata`, `menu_details`) -> JSON オブジェクト (`dict`)
 * - エポックミリ秒 (`start_time`, `end_time`, `detected_at`) -> ISO 8601 文字列
 */
export function serializeLocalRecord(
  table: TableName,
  rawRecord: Record<string, unknown>,
  isUpdate: boolean = false
): Record<string, unknown> {
  switch (table) {
    case TableName.USERS:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        name: rawRecord.name,
        relationship: rawRecord.relationship,
        role: rawRecord.role,
        theme_mode: rawRecord.theme_mode ?? 'light',
      };

    case TableName.CHILDREN:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        name: rawRecord.name,
        gender: rawRecord.gender,
        birth_date: rawRecord.birth_date,
        color_theme: rawRecord.color_theme ?? 'blue',
      };

    case TableName.RECORDS: {
      const payload: Record<string, unknown> = {
        recorded_by: rawRecord.recorded_by ?? null,
        category: rawRecord.category,
        start_time: toIsoDateTime(rawRecord.start_time),
        end_time: toIsoDateTime(rawRecord.end_time),
        amount: rawRecord.amount ?? null,
        metadata: RecordModel.parseMetadata(
          rawRecord.metadata as string | null
        ),
      };
      if (!isUpdate) {
        payload.id = rawRecord.id;
        payload.child_id = rawRecord.child_id;
      }
      return payload;
    }

    case TableName.PRESCRIPTIONS: {
      const payload: Record<string, unknown> = {
        medicine_name: rawRecord.medicine_name,
        dosage_per_time: rawRecord.dosage_per_time,
        frequency_type: rawRecord.frequency_type,
        days: rawRecord.days,
        start_date: rawRecord.start_date,
      };
      if (!isUpdate) {
        payload.id = rawRecord.id;
        payload.child_id = rawRecord.child_id;
      }
      return payload;
    }

    case TableName.CAMERA_EVENTS:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        child_id: rawRecord.child_id,
        event_type: rawRecord.event_type,
        confidence: rawRecord.confidence,
        detected_at: toIsoDateTime(rawRecord.detected_at),
      };

    case TableName.NURSERY_MENUS:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        target_date: rawRecord.target_date,
        menu_details: (() => {
          try {
            return typeof rawRecord.menu_details === 'string'
              ? JSON.parse(rawRecord.menu_details || '{}')
              : rawRecord.menu_details ?? {};
          } catch {
            return {};
          }
        })(),
      };
  }
}

/**
 * ローカルDBに既に存在するIDかどうかを判定し、created / updated に振り分ける
 */
async function partitionPulledRecords(
  database: Database,
  table: TableName,
  serverItems: Record<string, unknown>[]
): Promise<{ created: RawSyncRecord[]; updated: RawSyncRecord[]; deleted: string[] }> {
  if (serverItems.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const normalized = serverItems.map((item) =>
    deserializeServerRecord(table, item)
  );
  const ids = normalized.map((item) => item.id);

  const collection = database.get(table);
  const existingModels = await collection
    .query(Q.where('id', Q.oneOf(ids)))
    .fetch();
  const existingIds = new Set(existingModels.map((m) => m.id));

  const created: RawSyncRecord[] = [];
  const updated: RawSyncRecord[] = [];

  for (const record of normalized) {
    if (existingIds.has(record.id)) {
      updated.push(record);
    } else {
      created.push(record);
    }
  }

  return { created, updated, deleted: [] };
}

/**
 * Pull処理: FastAPI の各エンドポイントから最新データを取得し、WatermelonDB 形式に変換
 */
async function pullChangesFromFastApi(
  database: Database,
  { lastPulledAt }: SyncPullArgs,
  childIdFilter?: string
): Promise<SyncPullResult> {
  const changes: SyncDatabaseChangeSet = {};
  const timestamp = Date.now();

  await Promise.all(
    SYNC_TABLE_ORDER.map(async (table) => {
      const endpoint = TABLE_ENDPOINTS[table];
      const params: Record<string, string | number | undefined> = {
        limit: 500,
      };
      if (
        childIdFilter &&
        (table === TableName.RECORDS ||
          table === TableName.PRESCRIPTIONS ||
          table === TableName.CAMERA_EVENTS)
      ) {
        params.child_id = childIdFilter;
      }

      const items = await apiClient.get<Record<string, unknown>[]>(
        endpoint,
        params
      );

      changes[table] = await partitionPulledRecords(database, table, items);
    })
  );

  return {
    changes,
    timestamp,
  };
}

/**
 * Push処理: ローカルでの作成・更新・削除を FastAPI の各 REST エンドポイントへ送信
 */
async function pushChangesToFastApi({
  changes,
}: SyncPushArgs): Promise<void> {
  for (const table of SYNC_TABLE_ORDER) {
    const tableChanges = changes[table];
    if (!tableChanges) {
      continue;
    }

    const baseEndpoint = TABLE_ENDPOINTS[table];

    // 1. 新規作成レコードの送信 (POST /{resource}/)
    for (const raw of tableChanges.created) {
      const payload = serializeLocalRecord(
        table,
        raw as Record<string, unknown>,
        false
      );
      await apiClient.post(baseEndpoint, payload);
    }

    // 2. 更新レコードの送信 (PATCH /{resource}/{id})
    // camera_events はイミュータブルな受信ログのため PATCH 対象外
    if (table !== TableName.CAMERA_EVENTS) {
      for (const raw of tableChanges.updated) {
        const recordId = String(raw.id);
        const payload = serializeLocalRecord(
          table,
          raw as Record<string, unknown>,
          true
        );
        try {
          await apiClient.patch(`${baseEndpoint}${recordId}`, payload);
        } catch (error) {
          // サーバー側に未登録だった場合は POST にフォールバック
          if (error instanceof ApiError && error.status === 404) {
            const createPayload = serializeLocalRecord(
              table,
              raw as Record<string, unknown>,
              false
            );
            await apiClient.post(baseEndpoint, createPayload);
          } else {
            throw error;
          }
        }
      }
    }

    // 3. 削除レコードの送信 (DELETE /{resource}/{id})
    if (table !== TableName.CAMERA_EVENTS) {
      for (const deletedId of tableChanges.deleted) {
        try {
          await apiClient.delete(`${baseEndpoint}${deletedId}`);
        } catch (error) {
          // 既にサーバー側で削除済みの場合は 404 を無視して同期完了とする
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
        }
      }
    }
  }
}

export interface SyncOptions {
  database?: Database;
  childId?: string;
  onSyncStart?: () => void;
  onSyncSuccess?: (syncedAt: Date) => void;
  onSyncError?: (error: unknown) => void;
}

let isSyncing = false;

/**
 * WatermelonDB と FastAPI バックエンドを双方向同期するメイン関数
 * オフライン時はローカルDBへの書き込みが即座に完了しており、オンライン復帰時に本関数を呼ぶことで同期される。
 */
export async function syncDatabase(options: SyncOptions = {}): Promise<boolean> {
  if (isSyncing) {
    return false;
  }

  const db = options.database ?? defaultDatabase;
  isSyncing = true;
  options.onSyncStart?.();

  try {
    await synchronize({
      database: db,
      pullChanges: (pullArgs) =>
        pullChangesFromFastApi(db, pullArgs, options.childId),
      pushChanges: (pushArgs) => pushChangesToFastApi(pushArgs),
      migrationsEnabledAtVersion: 1,
    });

    options.onSyncSuccess?.(new Date());
    return true;
  } catch (error) {
    console.warn('[Sync] Synchronization failed (offline mode continues):', error);
    options.onSyncError?.(error);
    return false;
  } finally {
    isSyncing = false;
  }
}
