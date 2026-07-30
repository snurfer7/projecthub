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

### 権限設定を伴う実装（必須）

**システムスコープ**（`frontend/` + `backend/`）で、ユーザーが触る **機能（画面・API）** または **フォーム項目** を新規追加・変更する場合は、**権限設定も同一変更に含めて実装する**。権限なしの機能・項目を残してはならない。

#### 対象

| 追加・変更の種類 | 権限で行うこと |
|----------------|---------------|
| 新しい画面・ルート・メニュー | 権限カタログに feature を追加し、`canUse` で表示・ルートガード |
| 新しい API（GET / POST / PUT / DELETE） | 対応 code に `requirePermission(..., 'use' \| 'input')` を付与 |
| 新しいフォーム項目・編集可能フィールド | 権限カタログに field を追加し、PUT 時のフィールド検証 + フロント `disabled` |
| 新規/編集/削除ボタン | フロントで `canInput` により表示制御 |

#### 実装チェックリスト（システムスコープ）

1. **doc 更新**（機能実装 doc と同時）
   - [backend/DATA_MODEL.md](backend/DATA_MODEL.md) — 追加する PermissionResource（code・name・親子）を記載
   - [backend/API_SPEC.md](backend/API_SPEC.md) — 各エンドポイントの必要権限 code を記載
   - [frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md) — 表示条件・ルートガードに使う code を記載
2. **権限カタログ**
   - [backend/src/constants/permissionCatalog.ts](../backend/src/constants/permissionCatalog.ts) に code・表示名・親子を追加
   - [backend/prisma/seed-permissions.ts](../backend/prisma/seed-permissions.ts) がカタログを参照していることを確認（通常は `permissionCatalog.ts` の更新のみで足りる）
   - 本番 seed は `npm run build` 後に `npm run prisma:seed:permissions:prod`（`dist/` 経由。`src/` は本番に無い）
   - 既存 DB 環境では起動時のカタログ同期、または seed 再実行で `permission_resources` に反映（「全権限」「デフォルト」グループの作成は PermissionSet 0件の初期構築時のみ）
3. **バックエンド**
   - ルートに `requirePermission` / `requireAnyPermission` を適用
   - 部分更新 API では `assertFieldPermissions` で body キーと field code を検証
4. **フロントエンド**
   - メニュー・ルート: `canUse`（[Layout.tsx](../frontend/src/components/Layout.tsx)、[PermissionRoute](../frontend/src/components/PermissionRoute.tsx)）
   - 操作 UI: `canInput`（[PermissionGate](../frontend/src/components/PermissionGate.tsx) または `usePermissions`）
   - フォーム項目: 対応 field code で `disabled` / 非表示
5. **管理画面**
   - 新 feature / field は管理 > **権限設定** のマトリクスに自動表示される（カタログ seed 済みであること）

#### コード命名

- feature: `projects`, `projects.issues`, `companies.merge`, `admin.permission-sets` 等（ドット区切り）
- field: `projects.issues.fields.subject` 等（`.fields.` を挟む）。開始・終了は `startDateTime` / `endDateTime`（日付・時刻をまとめて制御）
- API 検証・フロントは **code 文字列** を正とし、`canUse` / `canInput` は PermissionSet または RolePermission のフラグ
- **プロジェクト詳細**（`projects` 配下の feature / field）は **Role** に紐づけ（`PermissionResource.scope = role`）。グループ PermissionSet にはトップレベル `projects`（機能 ON/OFF）のみ
- プロジェクト画面・API は `requireProjectPermission` / `myPermissions` でロール権限を検証（`User.isAdmin` ではバイパスしない）

#### スコープ外

- **モバイル**（`android/`）のみの変更では、本チェックリストの backend/frontend 権限実装は不要（API 契約変更時は backend 側の権限は要更新）。

> 機能だけ先にマージし、権限は後追い — **禁止**。受け入れ条件に権限の doc・seed・API・UI 反映を含める。

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
   - **権限カタログ・PermissionSet の追加** → [backend/DATA_MODEL.md](backend/DATA_MODEL.md)、[backend/API_SPEC.md](backend/API_SPEC.md)、[frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md)（[権限設定を伴う実装](#権限設定を伴う実装必須) チェックリストに従う）
   - Android の画面・ナビの変更 → [android/SCREENS_AND_NAVIGATION.md](android/SCREENS_AND_NAVIGATION.md)
   - Android の API 連携の変更 → [android/API_INTEGRATION.md](android/API_INTEGRATION.md)
3. doc の変更をコミットまたはステージングする
4. 更新したドキュメントの内容に従って実装を行う（スコープ外のコードは触らない）

> doc と実装が乖離した状態でのコミットは禁止。

API 契約（[backend/API_SPEC.md](backend/API_SPEC.md)）を変えた場合は、フロント・Android の該当ドキュメント（[frontend/API_USAGE.md](frontend/API_USAGE.md) / [android/API_INTEGRATION.md](android/API_INTEGRATION.md)）および実装が整合するようにする。

## ドキュメント構成

| ディレクトリ / ファイル | 対象 | 主な内容 |
|-------------|------|----------|
| [frontend/](frontend/) | Web フロントエンド (React + Vite) | 画面・ルート仕様、型定義、API 利用仕様 |
| [backend/](backend/) | API サーバー (Node.js + Express + Prisma) | API 仕様、データモデル、認証 |
| [android/](android/) | Android アプリ (Kotlin + Jetpack Compose) | 画面・ナビゲーション、API 連携 |
| [MICROSOFT_SSO.md](MICROSOFT_SSO.md) | 共通（運用） | Microsoft 365 SSO の Entra 設定・環境変数・ローカルテスト |

```
doc/
├── README.md                         # 本ファイル（doc 全体の説明・Agent ルール）
├── LIGHTSAIL_DEPLOYMENT.md           # デプロイ手順
├── MICROSOFT_SSO.md                  # Microsoft 365 SSO 設定・ローカルテスト
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
- [MICROSOFT_SSO.md](MICROSOFT_SSO.md) — Microsoft 365 SSO（Entra ID）の設定とローカルテスト手順
