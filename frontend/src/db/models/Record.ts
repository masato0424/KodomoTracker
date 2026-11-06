import { Model, Relation } from '@nozbe/watermelondb';
import { date, field, relation, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

import { TableName } from '../schema';
import { RecordCategory, RecordMetadata } from '../../types';
import type Child from './Child';
import type User from './User';

/**
 * 統合成長・生活ログモデル (records)
 *
 * バックエンドの `metadata` (JSONB) カラムは WatermelonDB のスキーマ上で
 * `string` 型として保存し、`parsedMetadata` / `setMetadata` を通じて型安全に扱う。
 */
export default class Record extends Model {
  static table = TableName.RECORDS;

  static associations: Associations = {
    [TableName.CHILDREN]: { type: 'belongs_to', key: 'child_id' },
    [TableName.USERS]: { type: 'belongs_to', key: 'recorded_by' },
  };

  @field('child_id') childId: string;
  @field('recorded_by') recordedBy: string | null;
  @field('category') category: RecordCategory;
  @date('start_time') startTime: Date;
  @date('end_time') endTime: Date | null;
  @field('amount') amount: number | null;

  /**
   * JSONB をシリアライズした文字列 (`string`) カラム
   * 例: '{"unit":"g","item_name":"和光堂ラタトゥイユ","is_auto_recorded":false}'
   */
  @field('metadata') metadata: string;

  @relation(TableName.CHILDREN, 'child_id') child: Relation<Child>;
  @relation(TableName.USERS, 'recorded_by') recorder: Relation<User>;

  /**
   * オブジェクトを JSON 文字列へ安全にシリアライズするユーティリティ
   */
  static serializeMetadata(meta?: RecordMetadata | string | null): string {
    if (!meta) {
      return '{}';
    }
    if (typeof meta === 'string') {
      try {
        JSON.parse(meta);
        return meta;
      } catch {
        return JSON.stringify({ note: meta });
      }
    }
    try {
      return JSON.stringify(meta);
    } catch {
      return '{}';
    }
  }

  /**
   * JSON 文字列を `RecordMetadata` オブジェクトへ安全にパースするユーティリティ
   */
  static parseMetadata(raw?: string | RecordMetadata | null): RecordMetadata {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'object') {
      return raw;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as RecordMetadata)
        : {};
    } catch {
      return {};
    }
  }

  /**
   * `metadata` (JSON文字列) を型付きオブジェクトとして取得するゲッター
   */
  get parsedMetadata(): RecordMetadata {
    return Record.parseMetadata(this.metadata);
  }

  /**
   * 所要時間（分）を計算するゲッター（睡眠等で使用）
   */
  get durationMinutes(): number | null {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    const diffMs = this.endTime.getTime() - this.startTime.getTime();
    return diffMs >= 0 ? Math.round(diffMs / 60000) : null;
  }

  /**
   * レコードを更新する Writer メソッド
   */
  @writer async updateRecord(params: {
    category?: RecordCategory;
    startTime?: Date;
    endTime?: Date | null;
    amount?: number | null;
    metadata?: RecordMetadata | string;
    recordedBy?: string | null;
  }): Promise<void> {
    await this.update((rec) => {
      if (params.category !== undefined) rec.category = params.category;
      if (params.startTime !== undefined) rec.startTime = params.startTime;
      if (params.endTime !== undefined) rec.endTime = params.endTime;
      if (params.amount !== undefined) rec.amount = params.amount;
      if (params.recordedBy !== undefined) rec.recordedBy = params.recordedBy;
      if (params.metadata !== undefined) {
        rec.metadata = Record.serializeMetadata(params.metadata);
      }
    });
  }

  /**
   * 同期対応の論理削除（markAsDeleted）を行う Writer メソッド
   */
  @writer async softDelete(): Promise<void> {
    await this.markAsDeleted();
  }
}
