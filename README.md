# KodomoTracker - 次世代スマート育児・成長記録アプリ

オフラインファーストな手動記録UI、OS音声アシスタント（LLM Structured Outputs）、および家庭内エッジAI（RTSPカメラ解析）を組み合わせ、日々の育児・成長記録の摩擦をゼロに近づけるスマート育児・成長記録プラットフォームです。

## アーキテクチャ構成

- **`frontend/`**: React Native (Expo SDK 52 / React Native Web) + WatermelonDB によるオフラインファースト・クロスプラットフォームクライアント
- **`backend/`**: Python 3.12 + FastAPI + SQLAlchemy 2.0 (PostgreSQL) + Alembic による REST / Sync / Webhook API バックエンド
- **`document/`**: フロントエンド・バックエンドの基本設計書および詳細設計書
- **`requirements.md`**: 機能要件（FR-01〜FR-09）・非機能要件・データモデル定義書（PRD）

## 主要機能 (FR-01 〜 FR-09)

- **[FR-01] オフラインファースト基本記録・編集・削除管理**: 授乳・離乳食・食事・睡眠・排泄・体温・身体測定5項目の即時CRUD、編集モーダルの差分検知（Dirty Check）による「更新」ボタン制御、カテゴリ連動の動的フォーム（`milk`, `baby_food`, `meal` 時のみ品名表示）。
- **[FR-02] レスポンシブナビゲーション＆アクセシビリティUI基盤**: 画面幅 `< 720px` でのハンバーガーメニュー自動切替、破壊的・取消アクション（削除・キャンセル）の赤色統一（`#DC2626` / `#F87171`）。
- **[FR-03] 子どもプロフィール管理＆パーソナライズカラーテーマ**: 複数子どもの登録・切替と6色カラーテーマ（WCAG AAコントラスト準拠）。
- **[FR-04] 家族・関係者アカウント管理＆ライト/ダークモード切替**: ロール管理（`admin` / `editor` / `viewer`）とユーザー別 Light/Dark モード即時切替。
- **[FR-05] 成長曲線・生活リズム可視化ダッシュボード**: 身体5項目の標準発育目安帯付き成長曲線、Outlook予定表風マルチカラム衝突回避アルゴリズムによる食事・排泄タイムプロット、日跨ぎ分割対応の睡眠タイムバー、37.5℃基準線付き体温グラフ。
- **[FR-06] 〜 [FR-09]**: 音声アシスタント構造化記録、RTSPスマートカメラエッジAI連携、服薬サジェスト＆Notifeeローカル通知、保育園献立管理。

## セットアップ手順

### バックエンド (FastAPI + PostgreSQL)

```bash
docker compose up -d
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### フロントエンド (Expo / React Native)

```bash
cd frontend
npm install
npx expo start
```
