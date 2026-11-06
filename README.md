# KodomoTracker - 次世代スマート育児・成長記録アプリ

オフラインファーストな手動記録UIとクラウド差分同期（WatermelonDB + FastAPI）を基盤とし、日々の育児・成長記録の摩擦を最小化するスマート育児・成長記録プラットフォームです。

## アーキテクチャ構成

- **`frontend/`**: React Native (Expo SDK 52 / React Native Web) + WatermelonDB によるオフラインファースト・クロスプラットフォームクライアント
- **`backend/`**: Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic による REST / Differential Sync / Webhook API バックエンド
- **`document/`**: フロントエンド・バックエンドの基本設計書および詳細設計書
- **`requirements.md`**: 機能要件（FR-01〜FR-09）・非機能要件・データモデル定義書（PRD）

## 実装フェーズと対応状況

### Phase 1: MVP コア基盤・可視化・オフライン同期・RBAC（実装・テスト完了）

- **[FR-01] オフラインファースト基本記録・編集・削除管理**
  - 授乳・離乳食・食事・睡眠・排泄・体温・身体測定5項目の即時CRUDと論理削除（`deleted_at`）。
  - カテゴリ別数値レンジ検証（ミルク・食事 `0〜2000`、体温 `32.0〜43.0`、身長 `20〜220`、体重 `0.3〜150`、頭囲・胸囲 `20〜120`、足のサイズ `5〜35`）および `end_time >= start_time` 検証。
  - 編集モーダルの差分検知（Dirty Check）＋バリデーション通過時のみ「更新」ボタンを活性化。
  - カテゴリ連動の動的フォーム（`milk`, `baby_food`, `meal` 時のみ品名欄を表示し、それ以外では `metadata.item_name` を自動除外）。
  - クライアント生成 UUID を保持する Last-Write-Wins (`updated_at`) UPSERT と、`/api/v1/sync/pull`・`/api/v1/sync/push` による差分同期。
- **[FR-02] レスポンシブナビゲーション＆アクセシビリティUI基盤**
  - 画面幅 `< 720px` でのハンバーガーメニュー自動切替（最小タップ領域 `44×44px` 確保、外側タップで閉じるオーバーレイ背景付き）。
  - 破壊的・取消アクション（削除・キャンセル）の赤色統一（Light `#DC2626` / Dark `#F87171`）。
- **[FR-03] 子どもプロフィール管理＆パーソナライズカラーテーマ**
  - 複数子どもの登録・切替と6色カラーテーマ（`blue`, `pink`, `emerald`, `orange`, `purple`, `teal` / WCAG AAコントラスト準拠）。
- **[FR-04] 家族・関係者アカウント管理＆RBAC・ライト/ダークモード切替**
  - ロールベースアクセス制御（`admin` / `editor` / `viewer`）：UI での権限制御に加え、バックエンド API でも `viewer` の書込操作および非 `admin` の子ども・ユーザー削除に対して `403 Forbidden` (`INSUFFICIENT_ROLE`) を返却。
  - JWT アクセストークン（15分）＆リフレッシュトークンローテーション（30日）エンドポイント（`/api/v1/auth/token`, `/api/v1/auth/refresh`）。
  - ユーザー別の Light / Dark モード即時切替。
- **[FR-05] 成長曲線・生活リズム可視化ダッシュボード**
  - 身体5項目の性別（`male` / `female` / `unspecified`）対応 3〜97パーセンタイル連続シェード帯＋50パーセンタイル中央値破線付き成長曲線（月齢除数 `30.4375` 日、学童期 216ヶ月まで動的スケーリング、子どもテーマ主色による描画）。
  - Outlook 予定表方式の貪欲法カラム割当アルゴリズムによる食事・排泄タイムプロット（最小占有枠 30分、`end_time` に応じたカード縦幅スケーリング）。
  - 日跨ぎ分割・未終了睡眠の現在時刻までの破線バー（`睡眠中`）表示・睡眠0の日を含む7日間按分の週平均睡眠時間（`X時間Y分` 表記）。
  - 37.5℃発熱基準線付き体温推移グラフ。

### Phase 2 / Phase 3: 拡張機能（API・スキーマ基盤実装済 / クライアント連携ロードマップ）

- **[FR-07] スマートカメラ Webhook 基盤**: HMAC-SHA256 (`X-Hub-Signature-256`) 署名検証・300秒以内のタイムスタンプ検証・5分間デバウンス（`202 Accepted`）・信頼度 `0.75` 以上での睡眠レコード自動連携（`/api/v1/webhooks/camera-events`）をバックエンドに実装済。RTSP エッジ推論ワーカーは Phase 3 で接続予定。
- **[FR-06 / FR-08 / FR-09]**: 処方箋（`aftermeal` / `intervalhours` / `specifictime`）・保育園献立の DB スキーマ・CRUD・同期基盤を実装済。OS 音声インテント・Notifee ローカル通知スケジューラ・献立 OCR 抽出は Phase 2/3 ロードマップ対象です。

## セットアップ手順

### バックエンド (FastAPI + PostgreSQL + Alembic)

```bash
docker compose up -d
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### フロントエンド (Expo SDK 52 / React Native)

```bash
cd frontend
npm install
npx expo start
```

## テスト実行手順

```bash
# バックエンド統合テスト (UPSERT/LWW差分同期・RBAC 403・バリデーション・Webhook HMAC検証)
PYTHONPATH=backend pytest backend/tests/test_api.py -v

# フロントエンド型チェック＆単体テスト (バリデーション・月齢/パーセンタイル・タイムラインレイアウト)
cd frontend
npm run typecheck
npm test
```
