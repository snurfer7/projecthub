# ProjectHub ドキュメント

本フォルダは **仕様駆動開発** に必要なドキュメントを格納します。  
フロントエンド・バックエンド・Android ごとに仕様を整理し、実装と仕様の乖離を防ぎ、受け入れ条件の明確化に利用します。

## Agent 駆動時のルール

実装（新機能・修正・リファクタ）に入る前に、**必ず本 `doc/` 下の該当ドキュメントを参照してから実装する**。仕様変更時は **ドキュメントを先に更新してから実装** すること。

### 実装前の参照先

| 作業対象 | 参照すべきドキュメント |
|---------|----------------------|
| Web フロントエンド | [frontend/](frontend/) |
| API サーバー (バックエンド) | [backend/](backend/) |
| Android アプリ | [android/](android/) |

各領域で参照するファイル:

- **Backend**
  - [backend/README.md](backend/README.md) — 索引
  - [backend/SPEC_OVERVIEW.md](backend/SPEC_OVERVIEW.md) — アーキテクチャ・認証
  - API を触る場合: [backend/API_SPEC.md](backend/API_SPEC.md)（契約）
  - データ構造を触る場合: [backend/DATA_MODEL.md](backend/DATA_MODEL.md) および `backend/prisma/schema.prisma`

- **Frontend**
  - [frontend/README.md](frontend/README.md) — 索引
  - 画面・ルートを触る場合: [frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md)
  - 型・API 利用: [frontend/DATA_MODELS.md](frontend/DATA_MODELS.md) と [frontend/API_USAGE.md](frontend/API_USAGE.md)

- **Android**
  - [android/README.md](android/README.md) — 索引
  - 画面・ナビを触る場合: [android/SCREENS_AND_NAVIGATION.md](android/SCREENS_AND_NAVIGATION.md)
  - API 連携: [android/API_INTEGRATION.md](android/API_INTEGRATION.md) および [backend/API_SPEC.md](backend/API_SPEC.md)

実装は、上記ドキュメントに書かれた仕様・契約に沿って行う。

### 仕様変更時のルール

#### スコープの指定（必須確認）

仕様変更・実装を行う際は、**必ず対象スコープを指定すること**。指定がない場合は作業を開始せず、指示者に確認すること。

| スコープ指定 | 変更を許可する領域 | 変更を禁止する領域 |
|------------|-----------------|-----------------|
| **システム** | `frontend/`、`backend/`、`doc/frontend/`、`doc/backend/` | `android/`、`doc/android/` |
| **モバイル** | `android/`、`doc/android/` | `frontend/`、`backend/`、`doc/frontend/`、`doc/backend/` |

> スコープ外のファイルへの変更は、指示があっても行ってはならない。

#### 変更手順

仕様変更を伴う実装（API・画面・データ・フローの変更）では、**ドキュメントを先に更新し、その後に実装する**。

1. スコープ（システム or モバイル）を確認する（指定がなければ指示者に確認）
2. 変更内容を該当 doc に反映する（スコープ外の doc は触らない）
   - API の追加・変更・削除 → [backend/API_SPEC.md](backend/API_SPEC.md)。必要なら [backend/DATA_MODEL.md](backend/DATA_MODEL.md) も更新
   - バックエンドの責務・構成の変更 → [backend/SPEC_OVERVIEW.md](backend/SPEC_OVERVIEW.md)
   - フロントの画面・ルートの変更 → [frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md)。型が変わる場合は [frontend/DATA_MODELS.md](frontend/DATA_MODELS.md) も更新
   - フロントの API の呼び方・クライアントの使い方の変更 → [frontend/API_USAGE.md](frontend/API_USAGE.md)
   - Android の画面・ナビの変更 → [android/SCREENS_AND_NAVIGATION.md](android/SCREENS_AND_NAVIGATION.md)
   - Android の API 連携の変更 → [android/API_INTEGRATION.md](android/API_INTEGRATION.md)
3. doc の変更をコミットまたはステージングする
4. 更新したドキュメントの内容に従って実装を行う（スコープ外のコードは触らない）

> doc と実装が乖離した状態でのコミットは禁止。

API 契約（[backend/API_SPEC.md](backend/API_SPEC.md)）を変えた場合は、フロント・Android の該当ドキュメント（[frontend/API_USAGE.md](frontend/API_USAGE.md) / [android/API_INTEGRATION.md](android/API_INTEGRATION.md)）および実装が整合するようにする。

## ドキュメント構成

| ディレクトリ | 対象 | 主な内容 |
|-------------|------|----------|
| [frontend/](frontend/) | Web フロントエンド (React + Vite) | 画面・ルート仕様、型定義、API 利用仕様 |
| [backend/](backend/) | API サーバー (Node.js + Express + Prisma) | API 仕様、データモデル、認証 |
| [android/](android/) | Android アプリ (Kotlin + Jetpack Compose) | 画面・ナビゲーション、API 連携 |

```
doc/
├── README.md                         # 本ファイル（doc 全体の説明・Agent ルール）
├── LIGHTSAIL_DEPLOYMENT.md           # デプロイ手順
├── frontend/
│   ├── README.md                     # 索引
│   ├── SPEC_OVERVIEW.md              # フロントエンド仕様概要
│   ├── SCREENS_AND_ROUTES.md         # 画面・ルート一覧
│   ├── DATA_MODELS.md                # 型定義
│   └── API_USAGE.md                  # API 利用仕様
├── backend/
│   ├── README.md                     # 索引
│   ├── SPEC_OVERVIEW.md              # バックエンド仕様概要
│   ├── API_SPEC.md                   # API 仕様（契約）
│   └── DATA_MODEL.md                 # Prisma データモデル
└── android/
    ├── README.md                     # 索引
    ├── SPEC_OVERVIEW.md              # Android 仕様概要
    ├── SCREENS_AND_NAVIGATION.md     # 画面・ナビゲーション
    └── API_INTEGRATION.md            # API 連携仕様
```

## 仕様駆動開発での利用

- **要件・仕様の参照**: 新機能追加・変更時に各領域の `SPEC_OVERVIEW.md` で概要を確認する。
- **API 契約**: バックエンドの `API_SPEC.md` を API 契約として共有し、フロント・Android はこれに従う。
- **画面・フロー**: フロントは `SCREENS_AND_ROUTES.md`、Android は `SCREENS_AND_NAVIGATION.md` で画面一覧と遷移を確認する。
- **データモデル**: バックエンドの Prisma スキーマ（`backend/prisma/schema.prisma`）を正とする。フロント・Android の型は `DATA_MODEL.md` と整合させる。

## その他のドキュメント

- [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) — AWS Lightsail へのデプロイ手順（Frontend / Backend / PostgreSQL）
