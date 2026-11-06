# 要件定義書：次世代スマート育児・成長記録アプリ

## 1 プロダクト概要

* **目的:** 日々の育児記録の摩擦を極限まで減らし、ローカルAIによる自動化とパーソナライズされた提案で育児負担を軽減する、完全プライベートな育児・成長アシスタント。
* **想定ユーザー:** 親、祖父母、ベビーシッターなど、子どもに関わる全ての関係者
* **将来展望:** 乳幼児期の記録にとどまらず、小学生〜高校生以降も長期的な健康・成長記録プラットフォームとして活用できる設計とする。
* **開発アプローチ:** Google Antigravity CLIによるマルチエージェント駆動開発。フロントエンド、バックエンド、エッジAIのモジュールを疎結合に設計し、段階的に実装する。

## 2 システムアーキテクチャと技術スタック

* **フロントエンド (モバイルクライアント)**
  * **フレームワーク:** React Native (Expo)  iOS/Androidクロスプラットフォーム対応
  * **ローカルDB:** WatermelonDB または Expo SQLite (オフラインファースト・即時UI反映)
  * **通知:** Notifee (オフライン環境でも動作する確実なローカル通知)
  * **拡張機能:** Expo Widgets (ホーム画面でのウィジェット連携)、OSネイティブショートカット連携 (Amazon Alexa / Google Assistant / Siri Shortcuts)
* **エッジAI環境 (ローカルネットワーク内 / Windows Server上のLinux Docker)**
  * **役割:** SwitchBot, Aqaraスマートカメラ等のRTSPストリーム直接解析
  * **技術:** Python, OpenCV, MediaPipe (姿勢推定・動体検知)
  * **制約:** 映像フレームはメモリ上で処理し即時破棄。判定結果（メタデータ）のみをクラウドへPOSTし、高度なプライバシーを担保する。
* **クラウドバックエンド (AWS環境)**
  * **API / ビジネスロジック:** Python, FastAPI, Pydantic v2
  * **データベース / ORM:** PostgreSQL, SQLAlchemy 2.0
  * **インフラ:** AWS ECS/Fargate, API Gateway, EventBridge (バッチ処理・通知トリガー)

## 3 主要機能要件

* **基本記録 ＆ 音声コマンド連携**
  * オフラインファーストの手動CRUD操作（新規記録作成・タイムライン上の記録クリックによる編集および「更新」ボタンでの変更反映・削除）。
  * タイムライン画面で各記録カードをクリック（タップ）すると既存の記録内容がセットされた状態で編集モーダルが開き、内容を変更した場合は「更新」ボタンが有効化されて記録を更新できる。
  * 記録入力・編集画面において、「4. メニュー・品名 (`metadata.item_name`)」の入力欄は「ミルク・授乳 (`milk`)」「離乳食 (`baby_food`)」「食事 (`meal`)」の3カテゴリ選択時のみ表示し、それ以外の記録項目（睡眠・排泄・体温・身長・体重・頭囲・胸囲・足のサイズ・その他）では非表示とする。
  * OSの音声アシスタント経由でAPIを叩き、LLM（Structured Outputs）で構造化して記録（例: 「和光堂ラタトゥイユ」は100g換算等、家庭内ルールを適用）。
* **ナビゲーション ＆ UIデザイン・アクセシビリティ要件**
  * **ヘッダーナビゲーション & レスポンシブハンバーガーメニュー:** メインメニュー（「タイムライン」「グラフ・成長曲線」「設定・管理」）は画面上部のヘッダーに配置する。ブラウザ画面（または端末画面）の横幅が小さくなった場合（`< 720px`）は、ヘッダーのメニューを三本線のハンバーガーアイコンに折りたたみ、タップでドロップダウンメニューを開閉できるようにする。
  * **破壊的・取消アクションの視認性統一:** アプリ内のすべての「削除」および「キャンセル」ボタン・アクションは一律で赤文字（ライトモード時 `#DC2626`、ダークモード時 `#F87171`）で表示する。
* **プロフィール・アカウント設定管理機能**
  * **子ども情報の管理（登録・編集・削除・表示切替・カラーテーマ設定）:** 設定画面から複数の子どものプロフィール（名前、性別、生年月日、カラーテーマ）を新規登録・編集・論理削除でき、表示・記録対象の子どもをワンタップで切り替え可能とする。また、子どもごとにカラーテーマ（ブルー、ピンク、グリーン、オレンジ、パープル、ティール）を設定でき、選択中の子どものカラーテーマに合わせて画面全体のアクセントカラー・ボタン・バッジ等を切り替えつつ、文字やアイコン、グラフのコントラストを維持して見づらくならないように表示する。
  * **ユーザー（家族・関係者）情報の編集・管理・ライト/ダークモード設定:** 設定画面から家族・関係者アカウント（表示名、子どもとの関係性、権限ロール、画面表示モード）の編集、新規メンバー追加、現在の記録者の切り替えを行える。ユーザーごとにライトモード (`light`)・ダークモード (`dark`) を設定でき、現在の記録者ユーザーの設定に応じて画面全体の背景・カード・テキスト・グラフ配色が即座に切り替わるようにする。
* **成長曲線・生活リズム可視化（グラフ・分析機能）**
  * **5項目の成長曲線表示:** 登録した記録をもとに、**身長 (`height`)・体重 (`weight`)・頭囲 (`head_circumference`)・胸囲 (`chest_circumference`)・足のサイズ (`foot_size`)** の推移を月齢別標準発育目安帯とともに折れ線グラフ（成長曲線）で表示する。
  * **食事・排泄の週単位タイムプロットグラフ表示:** 登録した記録をもとに、ミルク・離乳食・食事および排泄（おしっこ・うんち・両方）が行われた時間帯（0:00〜24:00）を週単位（7日間マトリクス）でグラフ表示し、日別の回数・摂取量サマリを確認できる。食事と排泄の記録タイミングが近い（または同一時刻の）場合は、Microsoft Outlookの予定表と同様に重なり合うイベントを自動でマルチカラム（横並び）に分割配置し、カード同士が重ならないように表示する。
  * **睡眠の開始・終了の週単位タイムバーグラフ表示:** 登録した記録をもとに、日々の睡眠の開始時刻〜終了時刻を週単位（7日間 × 0:00〜24:00 ガントバー形式、日跨ぎ睡眠の自動分割対応）でグラフ表示し、日別合計睡眠時間および週平均睡眠時間を算出する。
  * **体温の折れ線グラフ表示:** 登録した検温記録（`body_temp`）をもとに、発熱目安ライン（37.5℃）付きの折れ線グラフで体温推移を可視化する。
* **スマートカメラ自動記録 (RTSP連携)**
  * エッジAIが「就寝」「起床」「寝返り」「はいはい」「立ち上がり」を判定し、Webhook経由でバックエンドへ送信。
* **服薬管理・リマインダー**
  * 処方情報の登録と、Notifeeを用いた確実なローカル通知による飲み忘れ防止。
  * 処方薬はテキストの単なるフリー入力ではなく、入力途中で実際の薬の名称をサジェスチョン。
* **保育園・栄養・スケジュール連携**
  * 献立表OCR解析と家庭での食事履歴に基づく次食レコメンド（不足栄養素の補完）。
  * 睡眠・食事・排泄データからの連絡帳提出用文章のAI自動生成（下書き保存）。
  * 日本の祝日を除外した送迎アラート。
  * Google Calendar APIを用いた保育園行事の双方向同期。

## 4 データベース設計（PostgreSQL / SQLAlchemy 2.0）

長期的な運用（乳幼児〜青年期）や、多様な関係者による記録に対応するためのスキーマ構造とする。

* `users` **(家族・関係者アカウント)**
  * `id`: UUID (PK)
  * `name`: String
  * `relationship`: Enum (father, mother, grandfather, grandmother, babysitter, other) // 子どもとの関係性
  * `role`: Enum (admin, editor, viewer) // 権限管理（記録のみ可能なeditor等）
  * `theme_mode`: String (light, dark, default='light') // ユーザー別の画面表示モード（ライトモード / ダークモード）
* `children` **(子ども情報)**
  * `id`: UUID (PK)
  * `name`: String
  * `gender`: Enum (male, female, unspecified) // 成長曲線の統計等に利用
  * `birth_date`: Date
  * `color_theme`: String (blue, pink, emerald, orange, purple, teal, default='blue') // 子ども別のUIカラーテーマ
* `records` **(統合成長・生活ログ)**
  * `id`: UUID (PK)
  * `child_id`: UUID (FK  children.id)
  * `recorded_by`: UUID (FK  users.id, nullable=True) // 誰が記録したか
  * `category`: Enum (milk, baby_food, meal, sleep, excretion, body_temp, height, weight, head_circumference, chest_circumference, foot_size, custom)
  * `start_time`: DateTime(timezone=True)
  * `end_time`: DateTime(timezone=True, nullable=True)
  * `amount`: Float (nullable=True, 単位はメタデータに依存)
  * `metadata`: JSONB (例: `{"unit": "g", "item_name": "和光堂ラタトゥイユ", "is_auto_recorded": false}`)
* `prescriptions` **(処方箋・服薬マスタ)**
  * `id`: UUID (PK)
  * `child_id`: UUID (FK  children.id)
  * `medicine_name`: String
  * `dosage_per_time`: Float
  * `frequency_type`: Enum (aftermeal, intervalhours, specifictime)
  * `days`: Integer
  * `start_date`: Date
* `camera_events` **(エッジAIからの受信ログ)**
  * `id`: UUID (PK)
  * `child_id`: UUID (FK  children.id)
  * `event_type`: Enum (sleepstart, sleepend, rollover)
  * `confidence`: Float
  * `detected_at`: DateTime(timezone=True)
* `nursery_menus` **(保育園・学校献立データ)**
  * `id`: UUID (PK)
  * `target_date`: Date
  * `menu_details`: JSONB (献立内容、推定栄養素)

## 5 開発ロードマップ（Antigravityへの指示フェーズ）

* **Phase 1 (コア基盤):** FastAPIバックエンドのDB構築（上記スキーマ）・CRUD API実装。React Native (Expo) による基本記録画面とローカルDB (WatermelonDB) 同期処理の実装。
* **Phase 2 (IoT & AI入力):** 音声ショートカット連携の実装、エッジでのRTSP解析コンテナ構築、API連携による `camera_events` への自動記録とプッシュ通知。
* **Phase 3 (高度化):** OCR献立連携と栄養レコメンドエンジン、連絡帳AIドラフト生成、カレンダー・送迎通知（祝日除外ロジック含む）の実装。