import { Q } from '@nozbe/watermelondb';

import database, { collections, Child, Record as RecordModel, User } from '../db';
import {
  Gender,
  RecordCategory,
  RecordMetadata,
  RelationshipType,
  UserRole,
} from '../types';
import { ChildColorTheme, ThemeMode } from '../theme';

export interface CreateRecordInput {
  childId: string;
  recordedBy?: string | null;
  category: RecordCategory;
  startTime: Date;
  endTime?: Date | null;
  amount?: number | null;
  metadata?: RecordMetadata;
}

export interface UpdateRecordInput {
  recordedBy?: string | null;
  category?: RecordCategory;
  startTime?: Date;
  endTime?: Date | null;
  amount?: number | null;
  metadata?: RecordMetadata;
}

export interface CreateChildInput {
  name: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  colorTheme?: ChildColorTheme;
}

export interface UpdateChildInput {
  name?: string;
  gender?: Gender;
  birthDate?: string;
  colorTheme?: ChildColorTheme;
}

export interface CreateUserInput {
  name: string;
  relationship: RelationshipType;
  role: UserRole;
  themeMode?: ThemeMode;
}

export interface UpdateUserInput {
  name?: string;
  relationship?: RelationshipType;
  role?: UserRole;
  themeMode?: ThemeMode;
}

/**
 * オフラインファーストで新規育児記録を WatermelonDB に作成する
 * 書き込み完了と同時に `withObservables` で購読しているタイムライン・グラフUIへ即時反映される
 */
export async function createRecordOffline(
  input: CreateRecordInput
): Promise<RecordModel> {
  return database.write(async () => {
    return collections.records.create((rec) => {
      rec.childId = input.childId;
      rec.recordedBy = input.recordedBy ?? null;
      rec.category = input.category;
      rec.startTime = input.startTime;
      rec.endTime = input.endTime ?? null;
      rec.amount =
        input.amount !== undefined && input.amount !== null && !Number.isNaN(input.amount)
          ? input.amount
          : null;
      rec.metadata = RecordModel.serializeMetadata({
        is_auto_recorded: false,
        source: 'manual',
        ...(input.metadata ?? {}),
      });
    });
  });
}

/**
 * 既存の育児記録をオフラインファーストで更新する
 * 更新完了と同時に `withObservables` で購読しているタイムライン・グラフUIへ即時反映される
 */
export async function updateRecordOffline(
  record: RecordModel,
  input: UpdateRecordInput
): Promise<RecordModel> {
  const existingMeta = record.parsedMetadata;
  const nextMeta: RecordMetadata | undefined =
    input.metadata !== undefined
      ? {
          is_auto_recorded: existingMeta.is_auto_recorded ?? false,
          source: existingMeta.source ?? 'manual',
          ...input.metadata,
        }
      : undefined;

  await record.updateRecord({
    recordedBy: input.recordedBy,
    category: input.category,
    startTime: input.startTime,
    endTime: input.endTime,
    amount:
      input.amount !== undefined
        ? input.amount !== null && !Number.isNaN(input.amount)
          ? input.amount
          : null
        : undefined,
    metadata: nextMeta,
  });

  return record;
}

/**
 * 記録の論理削除（同期時にバックエンドへ DELETE 送信される）
 */
export async function deleteRecordOffline(record: RecordModel): Promise<void> {
  await record.softDelete();
}

/**
 * 子ども情報の新規登録
 */
export async function createChildOffline(
  input: CreateChildInput
): Promise<Child> {
  return database.write(async () => {
    return collections.children.create((child) => {
      child.name = input.name.trim();
      child.gender = input.gender;
      child.birthDate = input.birthDate.trim();
      child.colorTheme = input.colorTheme ?? ChildColorTheme.BLUE;
    });
  });
}

/**
 * 子ども情報の編集
 */
export async function updateChildOffline(
  child: Child,
  input: UpdateChildInput
): Promise<void> {
  await child.updateProfile({
    name: input.name !== undefined ? input.name.trim() : undefined,
    gender: input.gender,
    birthDate: input.birthDate !== undefined ? input.birthDate.trim() : undefined,
    colorTheme: input.colorTheme,
  });
}

/**
 * 子ども情報の論理削除（関連記録・処方箋も含む）
 */
export async function deleteChildOffline(child: Child): Promise<void> {
  await child.softDelete();
}

/**
 * ユーザー（家族・関係者）情報の新規登録
 */
export async function createUserOffline(input: CreateUserInput): Promise<User> {
  return database.write(async () => {
    return collections.users.create((user) => {
      user.name = input.name.trim();
      user.relationship = input.relationship;
      user.role = input.role;
      user.themeMode = input.themeMode ?? ThemeMode.LIGHT;
    });
  });
}

/**
 * ユーザー情報の編集
 */
export async function updateUserOffline(
  user: User,
  input: UpdateUserInput
): Promise<void> {
  await user.updateProfile({
    name: input.name !== undefined ? input.name.trim() : undefined,
    relationship: input.relationship,
    role: input.role,
    themeMode: input.themeMode,
  });
}

/**
 * ユーザー情報の論理削除
 */
export async function deleteUserOffline(user: User): Promise<void> {
  await user.softDelete();
}

/**
 * 成長曲線・週間食事/排泄・週間睡眠・体温グラフの動作確認用サンプルデータを投入する（内部Batch生成）
 */
function buildSampleRecordsInWriteBlock(
  child: Child,
  userId: string | null
): Promise<RecordModel[]> {
  const now = new Date();
  const birth = new Date(`${child.birthDate}T09:00:00`);
  const validBirth = Number.isNaN(birth.getTime())
    ? new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
    : birth;

  const itemsToCreate: Array<{
    category: RecordCategory;
    startTime: Date;
    endTime?: Date | null;
    amount?: number | null;
    metadata: RecordMetadata;
  }> = [];

  // 1. 成長曲線サンプルデータ (0ヶ月〜9ヶ月までの推移: 身長・体重・頭囲・胸囲・足のサイズ)
  const growthSamples = [
    { month: 0, height: 49.2, weight: 3.1, head: 33.2, chest: 32.0, foot: 8.0 },
    { month: 1, height: 53.8, weight: 4.3, head: 36.4, chest: 35.5, foot: 8.5 },
    { month: 3, height: 60.5, weight: 6.1, head: 39.8, chest: 40.2, foot: 9.5 },
    { month: 6, height: 66.2, weight: 7.6, head: 42.5, chest: 43.4, foot: 10.5 },
    { month: 9, height: 70.8, weight: 8.6, head: 44.3, chest: 45.2, foot: 11.5 },
  ];

  for (const g of growthSamples) {
    const sampleDate = new Date(
      validBirth.getTime() + g.month * 30.44 * 24 * 60 * 60 * 1000
    );
    if (sampleDate.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000) {
      itemsToCreate.push(
        {
          category: RecordCategory.HEIGHT,
          startTime: sampleDate,
          amount: g.height,
          metadata: { unit: 'cm', note: `${g.month}ヶ月計測`, source: 'manual' },
        },
        {
          category: RecordCategory.WEIGHT,
          startTime: sampleDate,
          amount: g.weight,
          metadata: { unit: 'kg', note: `${g.month}ヶ月計測`, source: 'manual' },
        },
        {
          category: RecordCategory.HEAD_CIRCUMFERENCE,
          startTime: sampleDate,
          amount: g.head,
          metadata: { unit: 'cm', note: `${g.month}ヶ月計測`, source: 'manual' },
        },
        {
          category: RecordCategory.CHEST_CIRCUMFERENCE,
          startTime: sampleDate,
          amount: g.chest,
          metadata: { unit: 'cm', note: `${g.month}ヶ月計測`, source: 'manual' },
        },
        {
          category: RecordCategory.FOOT_SIZE,
          startTime: sampleDate,
          amount: g.foot,
          metadata: { unit: 'cm', note: `${g.month}ヶ月計測`, source: 'manual' },
        }
      );
    }
  }

  // 2. 直近7日間の食事・排泄・睡眠・体温サンプルデータ
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const baseDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOffset,
      0,
      0,
      0
    );
    const atTime = (hour: number, minute: number) =>
      new Date(
        baseDay.getFullYear(),
        baseDay.getMonth(),
        baseDay.getDate(),
        hour,
        minute
      );

    // 夜間〜朝の睡眠 (00:00 - 06:30) ＆ 昼寝 (12:30 - 14:30) ＆ 夜の就寝 (20:30 - 23:59)
    const wakeMinute = (dayOffset % 2) * 20;
    itemsToCreate.push(
      {
        category: RecordCategory.SLEEP,
        startTime: atTime(0, 0),
        endTime: atTime(6, 20 + wakeMinute),
        metadata: { note: '夜間睡眠', source: 'manual' },
      },
      {
        category: RecordCategory.SLEEP,
        startTime: atTime(12, 30),
        endTime: atTime(14, 15 + (dayOffset % 3) * 15),
        metadata: { note: 'お昼寝', source: 'manual' },
      },
      {
        category: RecordCategory.SLEEP,
        startTime: atTime(20, 30 + (dayOffset % 2) * 15),
        endTime: atTime(23, 55),
        metadata: { note: '就寝', source: 'manual' },
      }
    );

    // 食事・授乳 (7:30, 11:30, 15:30, 18:30)
    itemsToCreate.push(
      {
        category: RecordCategory.MILK,
        startTime: atTime(7, 30),
        amount: 180,
        metadata: { unit: 'ml', item_name: '朝ミルク', source: 'manual' },
      },
      {
        category: RecordCategory.BABY_FOOD,
        startTime: atTime(11, 45),
        amount: 100,
        metadata: {
          unit: 'g',
          item_name: '和光堂ラタトゥイユ',
          source: 'manual',
        },
      },
      {
        category: RecordCategory.MILK,
        startTime: atTime(15, 30),
        amount: 160,
        metadata: { unit: 'ml', item_name: 'おやつ後ミルク', source: 'manual' },
      },
      {
        category: RecordCategory.MEAL,
        startTime: atTime(18, 30),
        amount: 120,
        metadata: { unit: 'g', item_name: '軟飯と野菜スープ', source: 'manual' },
      }
    );

    // 排泄 (8:00, 11:00, 14:45, 19:15)
    itemsToCreate.push(
      {
        category: RecordCategory.EXCRETION,
        startTime: atTime(8, 5),
        metadata: { excretion_type: 'pee', source: 'manual' },
      },
      {
        category: RecordCategory.EXCRETION,
        startTime: atTime(10, 50 + (dayOffset % 2) * 15),
        metadata: { excretion_type: 'both', note: '普通便', source: 'manual' },
      },
      {
        category: RecordCategory.EXCRETION,
        startTime: atTime(14, 45),
        metadata: { excretion_type: 'pee', source: 'manual' },
      },
      {
        category: RecordCategory.EXCRETION,
        startTime: atTime(19, 15),
        metadata: {
          excretion_type: dayOffset % 2 === 0 ? 'poop' : 'pee',
          source: 'manual',
        },
      }
    );

    // 体温 (8:15)
    const tempValues = [36.6, 36.7, 36.5, 37.1, 37.6, 36.9, 36.6];
    itemsToCreate.push({
      category: RecordCategory.BODY_TEMP,
      startTime: atTime(8, 15),
      amount: tempValues[dayOffset % tempValues.length],
      metadata: {
        unit: '℃',
        note: dayOffset === 2 ? '少し高め・様子見' : '朝の検温',
        source: 'manual',
      },
    });
  }

  return Promise.all(
    itemsToCreate.map((item) =>
      collections.records.create((rec) => {
        rec.childId = child.id;
        rec.recordedBy = userId;
        rec.category = item.category;
        rec.startTime = item.startTime;
        rec.endTime = item.endTime ?? null;
        rec.amount = item.amount ?? null;
        rec.metadata = RecordModel.serializeMetadata({
          is_auto_recorded: false,
          ...item.metadata,
        });
      })
    )
  );
}

/**
 * 任意のタイミングでグラフ確認用のサンプル記録データを追加投入する
 */
export async function seedSampleAnalyticsRecords(
  childId: string,
  userId?: string | null
): Promise<void> {
  const child = await collections.children.find(childId);
  await database.write(async () => {
    await buildSampleRecordsInWriteBlock(child, userId ?? null);
  });
}

/**
 * 初期起動時に子ども・ユーザー情報が未登録の場合、ローカル操作用のデフォルトデータを生成する
 */
export async function ensureInitialChildAndUser(): Promise<{
  child: Child;
  user: User;
}> {
  const existingChildren = await collections.children.query().fetch();
  const existingUsers = await collections.users.query().fetch();

  if (existingChildren.length > 0 && existingUsers.length > 0) {
    const firstChild = existingChildren[0];
    const firstUser = existingUsers[0];
    const recordCount = await collections.records
      .query(Q.where('child_id', firstChild.id))
      .fetchCount();

    // 初回サンプル（1件のみ）の状態であれば、グラフ確認用の初期サンプルデータを自動補完する
    if (recordCount <= 1) {
      await database.write(async () => {
        await buildSampleRecordsInWriteBlock(firstChild, firstUser.id);
      });
    }

    return {
      child: firstChild,
      user: firstUser,
    };
  }

  return database.write(async () => {
    const user =
      existingUsers[0] ??
      (await collections.users.create((u) => {
        u.name = 'ママ';
        u.relationship = RelationshipType.MOTHER;
        u.role = UserRole.ADMIN;
        u.themeMode = ThemeMode.LIGHT;
      }));

    const child =
      existingChildren[0] ??
      (await collections.children.create((c) => {
        c.name = 'はるか';
        c.gender = Gender.FEMALE;
        c.birthDate = '2026-01-15';
        c.colorTheme = ChildColorTheme.PINK;
      }));

    const recordCount = await collections.records
      .query(Q.where('child_id', child.id))
      .fetchCount();

    if (recordCount <= 1) {
      await buildSampleRecordsInWriteBlock(child, user.id);
    }

    return { child, user };
  });
}
