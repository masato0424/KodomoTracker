import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

import { TableName } from '../schema';
import { RelationshipType, UserRole } from '../../types';
import { normalizeThemeMode, ThemeMode } from '../../theme';
import type RecordModel from './Record';

/**
 * 家族・関係者アカウントモデル (users)
 */
export default class User extends Model {
  static table = TableName.USERS;

  static associations: Associations = {
    [TableName.RECORDS]: { type: 'has_many', foreignKey: 'recorded_by' },
  };

  @text('name') name: string;
  @field('relationship') relationship: RelationshipType;
  @field('role') role: UserRole;
  @field('theme_mode') themeMode: ThemeMode | null;

  @children(TableName.RECORDS) records: Query<RecordModel>;

  /**
   * 未設定時も安全な画面モード (light | dark) を返すゲッター
   */
  get resolvedThemeMode(): ThemeMode {
    return normalizeThemeMode(this.themeMode);
  }

  @writer async updateProfile(params: {
    name?: string;
    relationship?: RelationshipType;
    role?: UserRole;
    themeMode?: ThemeMode;
  }): Promise<void> {
    await this.update((user) => {
      if (params.name !== undefined) user.name = params.name;
      if (params.relationship !== undefined) {
        user.relationship = params.relationship;
      }
      if (params.role !== undefined) user.role = params.role;
      if (params.themeMode !== undefined) user.themeMode = params.themeMode;
    });
  }

  @writer async softDelete(): Promise<void> {
    await this.markAsDeleted();
  }
}
