import { Model, Relation } from '@nozbe/watermelondb';
import { date, field, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

import { TableName } from '../schema';
import { CameraEventType } from '../../types';
import type Child from './Child';

/**
 * エッジAIからの受信ログモデル (camera_events)
 */
export default class CameraEvent extends Model {
  static table = TableName.CAMERA_EVENTS;

  static associations: Associations = {
    [TableName.CHILDREN]: { type: 'belongs_to', key: 'child_id' },
  };

  @field('child_id') childId: string;
  @field('event_type') eventType: CameraEventType;
  @field('confidence') confidence: number;
  @date('detected_at') detectedAt: Date;
  @field('linked_record_id') linkedRecordId: string | null;

  @relation(TableName.CHILDREN, 'child_id') child: Relation<Child>;
}
