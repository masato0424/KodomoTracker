import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

import { TableName } from '../schema';
import { NurseryMenuDetails } from '../../types';

/**
 * 保育園・学校献立データモデル (nursery_menus)
 *
 * バックエンドの `menu_details` (JSONB) カラムは WatermelonDB のスキーマ上で
 * `string` 型として保存し、`parsedMenuDetails` ゲッターでオブジェクトとして参照する。
 */
export default class NurseryMenu extends Model {
  static table = TableName.NURSERY_MENUS;

  @field('target_date') targetDate: string; // YYYY-MM-DD
  @field('menu_details') menuDetails: string; // JSON string

  static serializeMenuDetails(
    details?: NurseryMenuDetails | string | null
  ): string {
    if (!details) {
      return '{}';
    }
    if (typeof details === 'string') {
      try {
        JSON.parse(details);
        return details;
      } catch {
        return JSON.stringify({ raw_ocr_text: details });
      }
    }
    try {
      return JSON.stringify(details);
    } catch {
      return '{}';
    }
  }

  get parsedMenuDetails(): NurseryMenuDetails {
    if (!this.menuDetails) {
      return {};
    }
    try {
      const parsed = JSON.parse(this.menuDetails);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as NurseryMenuDetails)
        : {};
    } catch {
      return {};
    }
  }
}
