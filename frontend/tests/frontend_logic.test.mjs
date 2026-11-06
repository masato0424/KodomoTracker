import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * TypeScript モジュールをオンメモリでトランスパイルして評価するヘルパー
 */
function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.resolve(process.cwd(), relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  });

  const moduleObj = { exports: {} };
  const customRequire = (id) => {
    if (id in mocks) {
      return mocks[id];
    }
    if (id.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fullPath), id);
      if (fs.existsSync(`${resolved}.ts`)) {
        return loadTsModule(path.relative(process.cwd(), `${resolved}.ts`), mocks);
      }
      if (fs.existsSync(`${resolved}.tsx`)) {
        return loadTsModule(path.relative(process.cwd(), `${resolved}.tsx`), mocks);
      }
      if (fs.existsSync(path.join(resolved, 'index.ts'))) {
        return loadTsModule(
          path.relative(process.cwd(), path.join(resolved, 'index.ts')),
          mocks
        );
      }
    }
    return {};
  };

  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(moduleObj.exports, customRequire, moduleObj);
  return moduleObj.exports;
}

const enumsMod = loadTsModule('src/types/enums.ts');
const analyticsMod = loadTsModule('src/screens/AnalyticsScreen.tsx', {
  react: {
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useState: (init) => [init, () => {}],
  },
  'react-native': {
    StyleSheet: { create: (s) => s },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    ScrollView: 'ScrollView',
  },
  '@nozbe/watermelondb': {
    Q: {
      where: () => ({}),
      sortBy: () => ({}),
      asc: 'asc',
    },
  },
  '@nozbe/watermelondb/react': {
    withObservables: () => (comp) => comp,
  },
  '../db': {
    collections: {
      children: { findAndObserve: () => ({}) },
      records: {
        query: () => ({ observeWithColumns: () => ({}) }),
      },
    },
  },
  '../services': {
    seedSampleAnalyticsRecords: async () => {},
  },
  '../theme': {
    useAppTheme: () => ({ isDark: false }),
  },
  '../types': enumsMod,
});

test('FR-01: validateRecordFormInput validates numeric ranges, time order, and broken dates', () => {
  const { RecordCategory, validateRecordFormInput } = enumsMod;

  // 正常なミルク記録
  const validMilk = validateRecordFormInput({
    category: RecordCategory.MILK,
    hasAmount: true,
    hasDuration: false,
    amountInput: '160',
    durationMinutesInput: '',
    startOffsetMinutes: null,
    customDateInput: '2026-06-01',
    customTimeInput: '10:00',
  });
  assert.equal(validMilk.isValid, true);
  assert.equal(validMilk.parsedAmount, 160);

  // 範囲外のミルク量 (> 2000)
  const overMilk = validateRecordFormInput({
    category: RecordCategory.MILK,
    hasAmount: true,
    hasDuration: false,
    amountInput: '2500',
    durationMinutesInput: '',
    startOffsetMinutes: null,
    customDateInput: '2026-06-01',
    customTimeInput: '10:00',
  });
  assert.equal(overMilk.isValid, false);
  assert.match(overMilk.errorMessage ?? '', /0\s*〜\s*2000/);

  // 範囲外の体温 (< 32.0)
  const lowTemp = validateRecordFormInput({
    category: RecordCategory.BODY_TEMP,
    hasAmount: true,
    hasDuration: false,
    amountInput: '30.5',
    durationMinutesInput: '',
    startOffsetMinutes: null,
    customDateInput: '2026-06-01',
    customTimeInput: '10:00',
  });
  assert.equal(lowTemp.isValid, false);

  // 負の所要時間（終了時刻 < 開始時刻）はエラー
  const reversedTime = validateRecordFormInput({
    category: RecordCategory.SLEEP,
    hasAmount: false,
    hasDuration: true,
    amountInput: '',
    durationMinutesInput: '-30',
    startOffsetMinutes: null,
    customDateInput: '2026-06-01',
    customTimeInput: '12:00',
  });
  assert.equal(reversedTime.isValid, false);
  assert.match(reversedTime.errorMessage ?? '', /end_time >= start_time/);

  // 壊れた日時文字列は new Date() に黙ってフォールバックせずエラーにする
  const brokenDate = validateRecordFormInput({
    category: RecordCategory.EXCRETION,
    hasAmount: false,
    hasDuration: false,
    amountInput: '',
    durationMinutesInput: '',
    startOffsetMinutes: null,
    customDateInput: '2026-02-31',
    customTimeInput: '10:00',
  });
  assert.equal(brokenDate.isValid, false);
  assert.equal(brokenDate.parsedStartTime, null);
});

test('FR-05: calculateAgeInMonths uses 30.4375 days divisor and percentiles support school age', () => {
  const {
    AGE_MONTH_DIVISOR_DAYS,
    calculateAgeInMonths,
    GROWTH_METRICS,
    interpolatePercentileAtMonth,
  } = analyticsMod;

  assert.equal(AGE_MONTH_DIVISOR_DAYS, 30.4375);

  const birth = new Date('2026-01-01T00:00:00Z');
  const oneYearLater = new Date(
    birth.getTime() + 12 * 30.4375 * 24 * 60 * 60 * 1000
  );
  assert.ok(Math.abs(calculateAgeInMonths(birth, oneYearLater) - 12) < 1e-6);

  // 男女でパーセンタイル基準が異なり、学童期（120ヶ月 = 10歳）までカバーされていること
  const heightConfig = GROWTH_METRICS[0];
  const male12m = interpolatePercentileAtMonth(
    heightConfig.percentilesByGender.male,
    12
  );
  const female12m = interpolatePercentileAtMonth(
    heightConfig.percentilesByGender.female,
    12
  );
  assert.ok(male12m.p50 > female12m.p50);
  assert.ok(male12m.p3 < male12m.p50 && male12m.p50 < male12m.p97);

  const schoolAge120m = interpolatePercentileAtMonth(
    heightConfig.percentilesByGender.male,
    120
  );
  assert.ok(schoolAge120m.p50 > 130);
});

test('FR-05: layoutDayTimelineEvents uses 30-min minimum slot, end_time height scaling, and N-column split', () => {
  const { RecordCategory } = enumsMod;
  const { layoutDayTimelineEvents, formatMinutesToHoursMinutes } = analyticsMod;

  // 同一時間帯 (10:00〜10:30) に4件重なった場合、横幅 100/4 = 25% ずつ4列に分割される
  const fourSimultaneous = [1, 2, 3, 4].map((i) => ({
    id: `ev-${i}`,
    record: {},
    category: i % 2 === 0 ? RecordCategory.EXCRETION : RecordCategory.MILK,
    minutesOfDay: 600, // 10:00
    timeStr: '10:00',
    icon: '🍼',
    color: '#000',
    bgColor: '#fff',
    shortLabel: 'テスト',
    amount: 100,
  }));

  const positioned4 = layoutDayTimelineEvents(fourSimultaneous);
  assert.equal(positioned4.length, 4);
  for (const ev of positioned4) {
    assert.equal(ev.totalCols, 4);
    assert.equal(ev.widthPct, 25);
    // 最小占有枠 30分 -> 30 / 1440 * 100 = 2.0833...%
    assert.ok(Math.abs(ev.heightPct - (30 / 1440) * 100) < 0.01);
  }

  // 40分離れたイベント (10:00 と 10:40) は最小占有枠 30分なので衝突せず 1列 (widthPct = 100%) になる
  const nonOverlappingAfter30Min = [
    {
      id: 'ev-a',
      record: {},
      category: RecordCategory.MILK,
      minutesOfDay: 600, // 10:00 (占有 600..630)
      timeStr: '10:00',
      icon: '🍼',
      color: '#000',
      bgColor: '#fff',
      shortLabel: 'A',
      amount: 100,
    },
    {
      id: 'ev-b',
      record: {},
      category: RecordCategory.EXCRETION,
      minutesOfDay: 640, // 10:40 (占有 640..670)
      timeStr: '10:40',
      icon: '💧',
      color: '#000',
      bgColor: '#fff',
      shortLabel: 'B',
      amount: null,
    },
  ];
  const positionedNonOverlap = layoutDayTimelineEvents(nonOverlappingAfter30Min);
  assert.equal(positionedNonOverlap[0].totalCols, 1);
  assert.equal(positionedNonOverlap[1].totalCols, 1);

  // endMinutesOfDay を指定した場合（例: 90分間の食事）、カード高さが 90/1440*100 = 6.25% に伸びる
  const longMeal = layoutDayTimelineEvents([
    {
      id: 'ev-long',
      record: {},
      category: RecordCategory.MEAL,
      minutesOfDay: 720,
      endMinutesOfDay: 810,
      timeStr: '12:00',
      icon: '🍽️',
      color: '#000',
      bgColor: '#fff',
      shortLabel: '昼食',
      amount: 150,
    },
  ]);
  assert.ok(Math.abs(longMeal[0].heightPct - (90 / 1440) * 100) < 0.01);

  // 睡眠時間フォーマットが小数時間ではなく「X時間Y分」形式であること
  assert.equal(formatMinutesToHoursMinutes(630), '10時間30分');
  assert.equal(formatMinutesToHoursMinutes(45), '0時間45分');
});
