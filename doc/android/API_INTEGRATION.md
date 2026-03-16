# Android API 連携仕様

## ApiService

- **ファイル**: `android/app/src/main/java/.../data/api/ApiService.kt`
- **定義**: Retrofit の `@GET` / `@POST` / `@PUT` / `@DELETE` で Backend の [API_SPEC.md](../backend/API_SPEC.md) に対応するエンドポイントを定義。
- **Base URL**: 実行時に変更可能。設定画面で保存した URL を Hilt の提供元（例: ApiServiceProvider）で使い、Retrofit の `baseUrl()` に渡す。

## エンドポイント対応（現在実装分）

- **Auth**: `POST api/auth/login`, `POST api/auth/register`, `GET api/auth/me`
- **Projects**: `GET api/projects`, `GET api/projects/{id}`
- **Issues**: `GET api/issues`（Query: projectId, statusId, trackerId, priorityId, assignedToId）, `GET api/issues/{id}`, `POST api/issues`, `PUT api/issues/{id}`, `DELETE api/issues/{id}`, `GET api/issues/meta/options`, `POST api/issues/{id}/comments`
- **Time Entries**: `GET api/time-entries`（Query: projectId, userId）, `POST api/time-entries`, `DELETE api/time-entries/{id}`
- **Companies**: `GET api/companies`, `GET api/companies/{id}`
- **Wiki**: `GET api/wiki/{projectId}`（一覧）, `GET api/wiki/{projectId}/{pageId}`（ページ取得）

※ 会社のコメント・Wiki・拠点、CRM（contacts/deals/activities）、添付・ガント・管理系などは ApiService に未定義の場合は必要に応じて追加する。

## 認証ヘッダー

- OkHttp の Interceptor で、保存済みトークンがあれば `Authorization: Bearer <token>` を付与。トークンは PreferencesManager 等で読み書き。
- 401 レスポンス時はトークンを削除し、ログイン画面へ遷移する処理をアプリ側で行う（必要に応じて Interceptor または Repository で実装）。

## Repository 層

- 各機能ごとに Repository（例: AuthRepository, ProjectRepository, IssueRepository, TimeRepository, CompanyRepository, Wiki 用）が ApiService を呼び出し、ViewModel は Repository を経由して API を利用する。
- ApiServiceProvider などで Base URL 変更時に Retrofit インスタンスを再生成し、Repository に注入し直す構成を推奨。

## データモデル（DTO）

- **ファイル**: `data/api/models/*.kt`（AuthModels, ProjectModels, IssueModels, TimeModels, CompanyModels 等）
- Backend のレスポンス形状および [DATA_MODEL.md](../backend/DATA_MODEL.md) に合わせて定義。日付は String（ISO 8601）で受け取り、画面でフォーマットする。

## Base URL 設定

- エミュレータ: `http://10.0.2.2:3000`（ホストの localhost）
- 実機: 同一 Wi‑Fi の PC の IP（例: `http://192.168.1.10:3000`）。設定画面で保存し、次回起動時から利用する。
- 詳細は [BUILD.md](../../android/doc/BUILD.md) の「バックエンドへの接続設定」を参照。
