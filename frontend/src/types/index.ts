/**
 * JSONBカラムおよびAPI通信用の構造化型定義
 */

export interface RecordMetadata {
  unit?: string;
  item_name?: string;
  note?: string;
  excretion_type?: 'pee' | 'poop' | 'both';
  is_auto_recorded?: boolean;
  source?: 'manual' | 'voice_assistant' | 'edge_camera';
  [key: string]: unknown;
}

export interface NurseryMenuDetails {
  dishes?: string[];
  calories_kcal?: number;
  nutrients?: {
    protein_g?: number;
    fat_g?: number;
    carbs_g?: number;
    iron_mg?: number;
    calcium_mg?: number;
  };
  allergens?: string[];
  raw_ocr_text?: string;
  [key: string]: unknown;
}

export * from './enums';
