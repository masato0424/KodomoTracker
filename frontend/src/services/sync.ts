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
 * - JSONB カラム (`metadata`, `schedule_details`, `menu_details`) -> JSON 文字列 (`string`)
 * - DateTime カラム (`start_time`, `end_time`, `detected_at`, `updated_at`) -> エポックミリ秒 (`number`)
 */
export function deserializeServerRecord(
  table: TableName,
  serverRecord: Record<string, unknown>
): RawSyncRecord {
  const id = String(serverRecord.id);
  const updatedAtMs = toEpochMs(serverRecord.updated_at) ?? Date.now();

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
        updated_at: updatedAtMs,
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
        updated_at: updatedAtMs,
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
        updated_at: updatedAtMs,
      };

    case TableName.PRESCRIPTIONS:
      return {
        id,
        child_id: String(serverRecord.child_id ?? ''),
        medicine_name: String(serverRecord.medicine_name ?? ''),
        dosage_per_time: Number(serverRecord.dosage_per_time ?? 0),
        frequency_type: String(serverRecord.frequency_type ?? 'aftermeal'),
        days: Number(serverRecord.days ?? 1),
        start_date: String(serverRecord.start_date ?? ''),
        schedule_details:
          typeof serverRecord.schedule_details === 'string'
            ? serverRecord.schedule_details
            : JSON.stringify(serverRecord.schedule_details ?? {}),
        updated_at: updatedAtMs,
      };

    case TableName.CAMERA_EVENTS:
      return {
        id,
        child_id: String(serverRecord.child_id ?? ''),
        event_type: String(serverRecord.event_type ?? 'sleepstart'),
        confidence: Number(serverRecord.confidence ?? 0),
        detected_at: toEpochMs(serverRecord.detected_at) ?? Date.now(),
        linked_record_id:
          serverRecord.linked_record_id !== null &&
          serverRecord.linked_record_id !== undefined
            ? String(serverRecord.linked_record_id)
            : null,
        updated_at: updatedAtMs,
      };

    case TableName.NURSERY_MENUS:
      return {
        id,
        target_date: String(serverRecord.target_date ?? ''),
        // JSONB オブジェクトを文字列(string)として保存
        menu_details: NurseryMenu.serializeMenuDetails(
          serverRecord.menu_details as Record<string, unknown> | string | null
        ),
        updated_at: updatedAtMs,
      };
  }
}

/**
 * WatermelonDB の RawRecord を FastAPI の Create / Update / Sync スキーマ形式へ変換
 * - クライアントの `id` と `updated_at` を保持し、サーバー側での UPSERT & Last-Write-Wins を保証する
 */
export function serializeLocalRecord(
  table: TableName,
  rawRecord: Record<string, unknown>,
  isUpdate: boolean = false
): Record<string, unknown> {
  const updatedAtIso =
    toIsoDateTime(rawRecord.updated_at) ?? new Date().toISOString();

  switch (table) {
    case TableName.USERS:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        name: rawRecord.name,
        relationship: rawRecord.relationship,
        role: rawRecord.role,
        theme_mode: rawRecord.theme_mode ?? 'light',
        updated_at: updatedAtIso,
      };

    case TableName.CHILDREN:
      return {
        ...(isUpdate ? {} : { id: rawRecord.id }),
        name: rawRecord.name,
        gender: rawRecord.gender,
        birth_date: rawRecord.birth_date,
        color_theme: rawRecord.color_theme ?? 'blue',
        updated_at: updatedAtIso,
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
        updated_at: updatedAtIso,
      };
      if (!isUpdate) {
        payload.id = rawRecord.id;
        payload.child_id = rawRecord.child_id;
      }
      return payload;
    }

    case TableName.PRESCRIPTIONS: {
      let scheduleDetails: Record<string, unknown> = {};
      if (typeof rawRecord.schedule_details === 'string') {
        try {
          scheduleDetails = JSON.parse(rawRecord.schedule_details || '{}');
        } catch {
          scheduleDetails = {};
        }
      } else if (
        rawRecord.schedule_details &&
        typeof rawRecord.schedule_details === 'object'
      ) {
        scheduleDetails = rawRecord.schedule_details as Record<string, unknown>;
      }
      const payload: Record<string, unknown> = {
        medicine_name: rawRecord.medicine_name,
        dosage_per_time: rawRecord.dosage_per_time,
        frequency_type: rawRecord.frequency_type ?? 'aftermeal',
        days: rawRecord.days,
        start_date: rawRecord.start_date,
        schedule_details: scheduleDetails,
        updated_at: updatedAtIso,
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
        linked_record_id: rawRecord.linked_record_id ?? null,
        updated_at: updatedAtIso,
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
        updated_at: updatedAtIso,
      };
  }
}

/**
 * ローカルDBに既に存在するIDかどうかを判定し、created / updated / deleted に振り分ける
 */
async function partitionPulledRecords(
  database: Database,
  table: TableName,
  serverItems: Record<string, unknown>[],
  deletedIds: string[] = []
): Promise<{
  created: RawSyncRecord[];
  updated: RawSyncRecord[];
  deleted: string[];
}> {
  if (serverItems.length === 0 && deletedIds.length === 0) {
    return { created: [], updated: [], deleted: [] };
  }

  const normalized = serverItems.map((item) =>
    deserializeServerRecord(table, item)
  );
  const ids = normalized.map((item) => item.id);

  const collection = database.get(table);
  const existingModels =
    ids.length > 0
      ? await collection.query(Q.where('id', Q.oneOf(ids))).fetch()
      : [];
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

  return { created, updated, deleted: deletedIds };
}

interface ServerSyncPullResponse {
  changes: Record<
    string,
    {
      created: Record<string, unknown>[];
      updated: Record<string, unknown>[];
      deleted: string[];
    }
  >;
  timestamp: number;
}

/**
 * Pull処理:
 * - FastAPI の差分同期エンドポイント (`GET /sync/pull?last_pulled_at=...`) を優先使用し、
 *   `updated_at > lastPulledAt` の更新差分および `deleted_at > lastPulledAt` の削除ID一覧を反映する。
 */
async function pullChangesFromFastApi(
  database: Database,
  { lastPulledAt }: SyncPullArgs,
  childIdFilter?: string
): Promise<SyncPullResult> {
  const changes: SyncDatabaseChangeSet = {};

  try {
    const syncResponse = await apiClient.get<ServerSyncPullResponse>(
      '/sync/pull',
      {
        last_pulled_at: lastPulledAt ?? 0,
        child_id: childIdFilter,
      }
    );

    await Promise.all(
      SYNC_TABLE_ORDER.map(async (table) => {
        const tablePayload = syncResponse.changes?.[table] ?? {
          created: [],
          updated: [],
          deleted: [],
        };
        const combinedActive = [
          ...(tablePayload.created ?? []),
          ...(tablePayload.updated ?? []),
        ];
        changes[table] = await partitionPulledRecords(
          database,
          table,
          combinedActive,
          tablePayload.deleted ?? []
        );
      })
    );

    return {
      changes,
      timestamp: syncResponse.timestamp || Date.now(),
    };
  } catch (err) {
    // Fallback to REST list endpoints only if /sync/pull is not supported (404)
    if (!(err instanceof ApiError && err.status === 404)) {
      throw err;
    }

    const timestamp = Date.now();
    await Promise.all(
      SYNC_TABLE_ORDER.map(async (table) => {
        const endpoint = TABLE_ENDPOINTS[table];
        const params: Record<string, string | number | undefined> = {
          limit: 200,
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
    return { changes, timestamp };
  }
}

/**
 * Push処理:
 * - ローカルでの作成・更新・削除を `POST /sync/push` にて1トランザクションで一括送信（クライアントID保持 + LWW）
 */
async function pushChangesToFastApi({
  changes,
  lastPulledAt,
}: SyncPushArgs): Promise<void> {
  const bulkChangesPayload: Record<
    string,
    {
      created: Record<string, unknown>[];
      updated: Record<string, unknown>[];
      deleted: string[];
    }
  > = {};

  let hasAnyChange = false;

  for (const table of SYNC_TABLE_ORDER) {
    const tableChanges = changes[table];
    if (!tableChanges) {
      continue;
    }
    const created = (tableChanges.created ?? []).map((raw) =>
      serializeLocalRecord(table, raw as Record<string, unknown>, false)
    );
    const updated =
      table === TableName.CAMERA_EVENTS
        ? []
        : (tableChanges.updated ?? []).map((raw) =>
            serializeLocalRecord(table, raw as Record<string, unknown>, false)
          );
    const deleted =
      table === TableName.CAMERA_EVENTS ? [] : tableChanges.deleted ?? [];

    if (created.length > 0 || updated.length > 0 || deleted.length > 0) {
      hasAnyChange = true;
      bulkChangesPayload[table] = { created, updated, deleted };
    }
  }

  if (!hasAnyChange) {
    return;
  }

  try {
    await apiClient.post('/sync/push', {
      changes: bulkChangesPayload,
      last_pulled_at: lastPulledAt ?? null,
    });
    return;
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) {
      throw err;
    }
  }

  // Fallback to individual REST endpoints if /sync/push is unavailable
  for (const table of SYNC_TABLE_ORDER) {
    const tableChanges = changes[table];
    if (!tableChanges) {
      continue;
    }

    const baseEndpoint = TABLE_ENDPOINTS[table];

    for (const raw of tableChanges.created) {
      const payload = serializeLocalRecord(
        table,
        raw as Record<string, unknown>,
        false
      );
      await apiClient.post(baseEndpoint, payload);
    }

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

      for (const deletedId of tableChanges.deleted) {
        try {
          await apiClient.delete(`${baseEndpoint}${deletedId}`);
        } catch (error) {
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
