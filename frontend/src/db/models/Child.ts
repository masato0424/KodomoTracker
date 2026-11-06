import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

import { TableName } from '../schema';
import { Gender } from '../../types';
import {
  ChildColorTheme,
  normalizeChildColorTheme,
} from '../../theme';
import type RecordModel from './Record';
import type Prescription from './Prescription';
import type CameraEvent from './CameraEvent';

/**
 * 子ども情報モデル (children)
 */
export default class Child extends Model {
  static table = TableName.CHILDREN;

  static associations: Associations = {
    [TableName.RECORDS]: { type: 'has_many', foreignKey: 'child_id' },
    [TableName.PRESCRIPTIONS]: { type: 'has_many', foreignKey: 'child_id' },
    [TableName.CAMERA_EVENTS]: { type: 'has_many', foreignKey: 'child_id' },
  };

  @text('name') name: string;
  @field('gender') gender: Gender;
  @field('birth_date') birthDate: string; // YYYY-MM-DD
  @field('color_theme') colorTheme: ChildColorTheme | null;

  @children(TableName.RECORDS) records: Query<RecordModel>;
  @children(TableName.PRESCRIPTIONS) prescriptions: Query<Prescription>;
  @children(TableName.CAMERA_EVENTS) cameraEvents: Query<CameraEvent>;

  /**
   * 誕生日文字列 (YYYY-MM-DD) から Date オブジェクトを返すヘルパー
   */
  get birthDateAsDate(): Date {
    return new Date(`${this.birthDate}T00:00:00`);
  }

  /**
   * 未設定時も安全なカラーテーマ識別子を返すゲッター
   */
  get resolvedColorTheme(): ChildColorTheme {
    return normalizeChildColorTheme(this.colorTheme);
  }

  @writer async updateProfile(params: {
    name?: string;
    gender?: Gender;
    birthDate?: string;
    colorTheme?: ChildColorTheme;
  }): Promise<void> {
    await this.update((child) => {
      if (params.name !== undefined) child.name = params.name;
      if (params.gender !== undefined) child.gender = params.gender;
      if (params.birthDate !== undefined) child.birthDate = params.birthDate;
      if (params.colorTheme !== undefined) child.colorTheme = params.colorTheme;
    });
  }

  /**
   * 子どもの論理削除（紐づく記録・処方箋も含めて削除マークを付与）
   */
  @writer async softDelete(): Promise<void> {
    const childRecords = await this.records.fetch();
    const childPrescriptions = await this.prescriptions.fetch();
    for (const rec of childRecords) {
      await rec.markAsDeleted();
    }
    for (const presc of childPrescriptions) {
      await presc.markAsDeleted();
    }
    await this.markAsDeleted();
  }
}
