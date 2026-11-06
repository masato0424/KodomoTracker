import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation, text, writer } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

import { TableName } from '../schema';
import { FrequencyType } from '../../types';
import type Child from './Child';

/**
 * 処方箋・服薬マスタモデル (prescriptions)
 */
export default class Prescription extends Model {
  static table = TableName.PRESCRIPTIONS;

  static associations: Associations = {
    [TableName.CHILDREN]: { type: 'belongs_to', key: 'child_id' },
  };

  @field('child_id') childId: string;
  @text('medicine_name') medicineName: string;
  @field('dosage_per_time') dosagePerTime: number;
  @field('frequency_type') frequencyType: FrequencyType;
  @field('days') days: number;
  @field('start_date') startDate: string; // YYYY-MM-DD

  @relation(TableName.CHILDREN, 'child_id') child: Relation<Child>;

  @writer async softDelete(): Promise<void> {
    await this.markAsDeleted();
  }
}
