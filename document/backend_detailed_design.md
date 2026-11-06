# KodomoTracker バックエンド詳細設計書

## 1. モジュール構成

バックエンドはレイヤードアーキテクチャに基づき、以下のディレクトリ・ファイル構成で実装されている。

```text
/workspaces/KodomoTracker
├── docker-compose.yml                  # PostgreSQL 16 + FastAPI 開発コンテナ定義
└── backend/
    ├── .env.example                    # 環境変数サンプル
    ├── alembic.ini                     # Alembic 設定ファイル
    ├── requirements.txt                # Python パッケージ依存定義
    ├── alembic/
    │   ├── env.py                      # マイグレーション実行環境 (app.models 読み込み)
    │   └── versions/
    │       └── 0001_initial_schema.py  # 初期スキーマ DDL マイグレーション
    └── app/
        ├── main.py                     # FastAPI アプリケーションエントリポイント・lifespan
        ├── init_db.py                  # 初期テーブル生成 CLI スクリプト
        ├── core/
        │   ├── config.py               # Pydantic BaseSettings による環境変数管理
        │   └── database.py             # SQLAlchemy Engine / SessionLocal / Base / get_db
        ├── models/
        │   ├── __init__.py             # 全 ORM モデルの一括エクスポート
        │   ├── enums.py                # StrEnum 定義群
        │   ├── user.py                 # User モデル (users)
        │   ├── child.py                # Child モデル (children)
        │   ├── record.py               # Record モデル (records)
        │   ├── prescription.py         # Prescription モデル (prescriptions)
        │   ├── camera_event.py         # CameraEvent モデル (camera_events)
        │   └── nursery_menu.py         # NurseryMenu モデル (nursery_menus)
        ├── schemas/
        │   ├── __init__.py             # 全 Pydantic スキーマの一括エクスポート
        │   ├── user.py                 # UserCreate / UserUpdate / UserRead
        │   ├── child.py                # ChildCreate / ChildUpdate / ChildRead
        │   ├── record.py               # RecordCreate / RecordUpdate / RecordRead
        │   ├── prescription.py         # PrescriptionCreate / PrescriptionUpdate / PrescriptionRead
        │   ├── camera_event.py         # CameraEventCreate / CameraEventRead
        │   └── nursery_menu.py         # NurseryMenuCreate / NurseryMenuUpdate / NurseryMenuRead
        └── routers/
            ├── __init__.py             # api_router 統合定義
            ├── users.py                # /users エンドポイント実装
            ├── children.py             # /children エンドポイント実装
            ├── records.py              # /records エンドポイント実装
            ├── prescriptions.py        # /prescriptions エンドポイント実装
            ├── camera_events.py        # /camera-events エンドポイント実装
            └── nursery_menus.py        # /nursery-menus エンドポイント実装
```

---

## 2. コア基盤設計 (`app/core/`)

### 2.1 環境設定 (`app/core/config.py`)
`pydantic_settings.BaseSettings` を継承した `Settings` クラスにより、環境変数または `.env` ファイルから設定値を型安全に読み込む。

| 設定項目 | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | `str` | `"KodomoTracker API"` | OpenAPI タイトル |
| `VERSION` | `str` | `"0.1.0"` | API バージョン文字列 |
| `API_V1_STR` | `str` | `"/api/v1"` | ルーター共通プレフィックス |
| `DATABASE_URL` | `str` | `"postgresql+psycopg://postgres:postgres@localhost:5432/kodomo_tracker"` | PostgreSQL 接続 URI |
| `DB_ECHO` | `bool` | `False` | SQLAlchemy 発行 SQL のログ出力有無 |
| `AUTO_CREATE_TABLES` | `bool` | `True` | 起動時の `Base.metadata.create_all` 自動実行有無 |

### 2.2 データベース接続・セッション管理 (`app/core/database.py`)
* **Engine**: `create_engine(settings.DATABASE_URL, echo=settings.DB_ECHO, pool_pre_ping=True)` により、コネクションプールから取得時に死活確認（`pool_pre_ping`）を行う。
* **SessionLocal**: `autocommit=False`, `autoflush=False`, `expire_on_commit=False` で構成。
* **DI ジェネレータ `get_db()`**: リクエスト単位で `Session` を生成し、`finally` ブロックで確実に `db.close()` を実行する。

---

## 3. 列挙型 (`app/models/enums.py`) 詳細定義

Python 3.11+ の `StrEnum` を継承し、PostgreSQL のネイティブ `ENUM` 型および Pydantic の JSON シリアライズ双方で小文字スネークケース文字列として扱う。

| クラス名 | PostgreSQL ENUM 型名 | 定義値 (`value`) | 用途 |
| :--- | :--- | :--- | :--- |
| `RelationshipType` | `relationship_type_enum` | `father`, `mother`, `grandfather`, `grandmother`, `babysitter`, `other` | 子どもとの続柄 |
| `UserRole` | `user_role_enum` | `admin`, `editor`, `viewer` | 操作権限ロール |
| `Gender` | `gender_enum` | `male`, `female`, `unspecified` | 子どもの性別 |
| `RecordCategory` | `record_category_enum` | `milk`, `baby_food`, `meal`, `sleep`, `excretion`, `body_temp`, `height`, `weight`, `custom` | 育児記録カテゴリ |
| `FrequencyType` | `frequency_type_enum` | `after_meal`, `interval_hours`, `specific_time` | 服薬タイミング種別 |
| `CameraEventType` | `camera_event_type_enum` | `sleep_start`, `sleep_end`, `rollover` | エッジAI検知種別 |

---

## 4. 物理データベース・ORMモデル詳細設計 (`app/models/`)

### 4.1 `users` テーブル (`User` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `name` | `name` | `VARCHAR(255)` | `False` | - | |
| `relationship` | `relationship` | `relationship_type_enum` | `False` | - | |
| `role` | `role` | `user_role_enum` | `False` | `UserRole.EDITOR` | |

* **ORM リレーション**: `records: Mapped[list[Record]]` (`back_populates="recorder"`)

### 4.2 `children` テーブル (`Child` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `name` | `name` | `VARCHAR(255)` | `False` | - | |
| `gender` | `gender` | `gender_enum` | `False` | `Gender.UNSPECIFIED` | |
| `birth_date` | `birth_date` | `DATE` | `False` | - | |

* **ORM リレーション**:
  * `records`: `cascade="all, delete-orphan"`
  * `prescriptions`: `cascade="all, delete-orphan"`
  * `camera_events`: `cascade="all, delete-orphan"`

### 4.3 `records` テーブル (`Record` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `child_id` | `child_id` | `UUID` | `False` | - | `FK(children.id, ON DELETE CASCADE)`, `ix_records_child_id` |
| `recorded_by` | `recorded_by` | `UUID` | `True` | `None` | `FK(users.id, ON DELETE SET NULL)`, `ix_records_recorded_by` |
| `category` | `category` | `record_category_enum` | `False` | - | `ix_records_category` |
| `start_time` | `start_time` | `TIMESTAMPTZ` | `False` | - | `ix_records_start_time` |
| `end_time` | `end_time` | `TIMESTAMPTZ` | `True` | `None` | |
| `amount` | `amount` | `FLOAT` | `True` | `None` | |
| `metadata` | `record_metadata` | `JSONB` | `False` | `dict` (`{}`) | ※SQLAlchemy予約語回避のため属性名は `record_metadata` |

> **設計上の重要事項 (`record_metadata` マッピング)**:
> SQLAlchemy の `DeclarativeBase` はクラス属性 `.metadata` をテーブルメタデータ管理用に使用するため、`Record` クラスでは Python 属性名を `record_metadata` とし、DB カラム名 `"metadata"` にマッピングしている（`mapped_column("metadata", JSONB, ...)`）。

### 4.4 `prescriptions` テーブル (`Prescription` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `child_id` | `child_id` | `UUID` | `False` | - | `FK(children.id, ON DELETE CASCADE)`, `ix_prescriptions_child_id` |
| `medicine_name` | `medicine_name` | `VARCHAR(255)` | `False` | - | |
| `dosage_per_time` | `dosage_per_time` | `FLOAT` | `False` | - | |
| `frequency_type` | `frequency_type` | `frequency_type_enum` | `False` | - | |
| `days` | `days` | `INTEGER` | `False` | - | |
| `start_date` | `start_date` | `DATE` | `False` | - | |

### 4.5 `camera_events` テーブル (`CameraEvent` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `child_id` | `child_id` | `UUID` | `False` | - | `FK(children.id, ON DELETE CASCADE)`, `ix_camera_events_child_id` |
| `event_type` | `event_type` | `camera_event_type_enum` | `False` | - | |
| `confidence` | `confidence` | `FLOAT` | `False` | - | |
| `detected_at` | `detected_at` | `TIMESTAMPTZ` | `False` | - | `ix_camera_events_detected_at` |

### 4.6 `nursery_menus` テーブル (`NurseryMenu` モデル)

| カラム名 | Python属性名 | DB型 | Nullable | デフォルト | 制約・インデックス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID` | `False` | `uuid.uuid4` | `PRIMARY KEY` |
| `target_date` | `target_date` | `DATE` | `False` | - | `ix_nursery_menus_target_date` |
| `menu_details` | `menu_details` | `JSONB` | `False` | `dict` (`{}`) | |

---

## 5. Pydantic スキーマ詳細設計 (`app/schemas/`)

各リソースは `Base`（共通フィールド）、`Create`（POST入力）、`Update`（PATCH部分更新・全フィールドOptional）、`Read`（レスポンス出力・`id` 付与・`from_attributes=True`）の4クラス構成（`camera_events` のみイミュータブルのため `Update` なし）で定義されている。

### 5.1 スキーマバリデーション制約一覧

| スキーマクラス | フィールド | 型 | バリデーション・エイリアス仕様 |
| :--- | :--- | :--- | :--- |
| `UserBase` | `name` | `str` | `Field(..., max_length=255)` |
| `UserBase` | `relationship` | `RelationshipType` | 必須 |
| `UserBase` | `role` | `UserRole` | デフォルト: `UserRole.EDITOR` |
| `ChildBase` | `name` | `str` | `Field(..., max_length=255)` |
| `ChildBase` | `gender` | `Gender` | デフォルト: `Gender.UNSPECIFIED` |
| `ChildBase` | `birth_date` | `date` | 必須 (`YYYY-MM-DD`) |
| `RecordBase` | `metadata` | `dict[str, Any]` | `validation_alias=AliasChoices("metadata", "record_metadata")`, `serialization_alias="metadata"` |
| `PrescriptionBase` | `medicine_name` | `str` | `Field(..., max_length=255)` |
| `PrescriptionBase` | `dosage_per_time` | `float` | `Field(..., gt=0)` (0より大きい値) |
| `PrescriptionBase` | `days` | `int` | `Field(..., gt=0)` (1日以上) |
| `CameraEventBase` | `confidence` | `float` | `Field(..., ge=0.0, le=1.0)` (0.0以上1.0以下) |

### 5.2 `RecordRead` における `metadata` 変換フロー
ORM インスタンス（`Record.record_metadata`）から JSON レスポンス（`"metadata"`）へ変換する際、`AliasChoices("metadata", "record_metadata")` により ORM 属性 `record_metadata` を自動的に読み取り、クライアントへは `"metadata"` キーとしてシリアライズする。

---

## 6. ルーター（APIコントローラ）詳細設計 (`app/routers/`)

### 6.1 育児ログ (`app/routers/records.py`) 処理詳細

#### (1) `POST /api/v1/records/` (`create_record`)
1. リクエストボディを `RecordCreate` で検証する。
2. `payload.model_dump()` から `"metadata"` キーを取り出し（`pop("metadata", {})`）、`Record(**data, record_metadata=record_metadata)` として ORM インスタンスを生成する。
3. `db.add(record)` -> `db.commit()` -> `db.refresh(record)` を実行し、`201 Created` で `RecordRead` を返却する。

#### (2) `GET /api/v1/records/` (`list_records`)
* **クエリパラメータ**:
  * `child_id: UUID | None = None`: 指定時は `Record.child_id == child_id` で絞り込み
  * `category: RecordCategory | None = None`: 指定時は `Record.category == category` で絞り込み
  * `skip: int = 0`, `limit: int = 100`: ページネーション
* **ソート順**: `Record.start_time.desc()`（新しい記録が先頭）

#### (3) `PATCH /api/v1/records/{record_id}` (`update_record`)
1. `db.get(Record, record_id)` で対象レコードを取得。存在しない場合は `404 Not Found` (`detail="Record not found"`) を送出。
2. `payload.model_dump(exclude_unset=True)` により、リクエストで明示的に指定されたフィールドのみを抽出。
3. `"metadata"` が含まれる場合は `record.record_metadata` を更新し、その他のフィールドは `setattr()` で反映して `db.commit()` する。

```mermaid
sequenceDiagram
  autonumber
  participant Client as モバイルクライアント (WatermelonDB)
  participant Router as FastAPI (/api/v1/records)
  participant Schema as Pydantic (RecordCreate/Read)
  participant ORM as SQLAlchemy Session
  participant DB as PostgreSQL

  Client->>Router: POST /api/v1/records/ (JSON: metadata オブジェクト含む)
  Router->>Schema: RecordCreate バリデーション
  Schema-->>Router: 検証済み payload
  Router->>ORM: Record(..., record_metadata=metadata) インスタンス化
  ORM->>DB: INSERT INTO records (..., metadata) VALUES (..., JSONB)
  DB-->>ORM: コミット完了
  ORM-->>Router: Record インスタンス (record_metadata 属性)
  Router->>Schema: RecordRead (AliasChoices で record_metadata -> metadata 変換)
  Schema-->>Client: 201 Created (JSON: id, metadata, ...)
```

### 6.2 その他ルーターのソート・フィルタ仕様

| ルーター | 一覧取得 (`GET /`) のフィルタ引数 | デフォルトソート順 | 更新・削除の可否 |
| :--- | :--- | :--- | :--- |
| `users.py` | `skip`, `limit` | PK順 | `PATCH` / `DELETE` 可 |
| `children.py` | `skip`, `limit` | PK順 | `PATCH` / `DELETE` 可 |
| `prescriptions.py` | `child_id`, `skip`, `limit` | `Prescription.start_date.desc()` | `PATCH` / `DELETE` 可 |
| `camera_events.py` | `child_id`, `skip`, `limit` | `CameraEvent.detected_at.desc()` | イミュータブル（`POST` / `GET` のみ） |
| `nursery_menus.py` | `target_date`, `skip`, `limit` | `NurseryMenu.target_date.desc()` | `PATCH` / `DELETE` 可 |

---

## 7. マイグレーション・コンテナ実行設計

### 7.1 Alembic マイグレーション (`alembic/versions/0001_initial_schema.py`)
* **`upgrade()`**:
  1. `users`, `children`, `nursery_menus` の親・独立テーブルを作成。
  2. `records`, `prescriptions`, `camera_events` の子テーブルを外部キー制約付きで作成。
  3. 検索頻度の高い外部キーおよび日時カラムに B-Tree インデックス（`ix_*`）を作成。
* **`downgrade()`**:
  1. 子テーブルから順にインデックスとテーブルを DROP。
  2. 最後に PostgreSQL 上の6つの ENUM 型（`camera_event_type_enum` 等）を `checkfirst=True` 付きで削除。

### 7.2 Docker Compose 構成 (`docker-compose.yml`)
* **`db` サービス**: `postgres:16-alpine` を使用し、`pg_isready` によるヘルスチェック（5秒間隔）を実施。
* **`api` サービス**: `db` の `service_healthy` 状態を確認後に起動し、`python -m app.init_db` でスキーマを保証した上で `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` を起動する。
