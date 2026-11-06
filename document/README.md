# KodomoTracker 設計ドキュメント一覧

本ディレクトリ（`document/`）には、次世代スマート育児・成長記録アプリ **KodomoTracker** のバックエンド（FastAPI / PostgreSQL）およびフロントエンド（Expo / React Native / WatermelonDB）の基本設計書・詳細設計書を格納しています。

## ドキュメント構成

| ドキュメント名 | ファイルパス | 内容概要 |
| :--- | :--- | :--- |
| **バックエンド基本設計書** | [backend_basic_design.md](./backend_basic_design.md) | システム全体構成、技術スタック、概念・論理ER図、テーブル一覧、REST API エンドポイント一覧、非機能・拡張方針 |
| **バックエンド詳細設計書** | [backend_detailed_design.md](./backend_detailed_design.md) | モジュール構成、環境設定、StrEnum 定義、物理テーブル・インデックス定義、SQLAlchemy 2.0 モデル設計、Pydantic v2 スキーマ設計、ルーター処理フロー、Alembic / Docker 構成 |
| **フロントエンド基本設計書** | [frontend_basic_design.md](./frontend_basic_design.md) | オフラインファースト・リアクティブアーキテクチャ、画面一覧・画面遷移図、PostgreSQL ⇔ WatermelonDB 型マッピング方針、クラウド同期方針 |
| **フロントエンド詳細設計書** | [frontend_detailed_design.md](./frontend_detailed_design.md) | ディレクトリ構成、カテゴリ設定マスタ、WatermelonDB 物理スキーマ・モデルクラス図、プラットフォーム別DBアダプタ自動解決仕様 (`adapter.native.ts` / `adapter.web.ts`)、JSONB 文字列シリアライズ仕様、`syncDatabase` 双方向同期シーケンス、各画面・コンポーネント (`withObservables`) 詳細仕様、環境別画面表示・実行および配信設計（ローカル・テスト・本番） |

## 関連ドキュメント・ソースコード

* 要件定義書: [../requirements.md](../requirements.md)
* バックエンド実装: [../backend/app/](../backend/app/) / マイグレーション: [../backend/alembic/](../backend/alembic/)
* フロントエンド実装: [../frontend/App.tsx](../frontend/App.tsx) / [../frontend/src/](../frontend/src/)
