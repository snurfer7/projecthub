# Android API 連携仕様

## ApiService

- **ファイル**: `android/app/src/main/java/.../data/api/ApiService.kt`
- **定義**: Retrofit の `@GET` / `@POST` / `@PUT` / `@DELETE` で Backend の [API_SPEC.md](../backend/API_SPEC.md) に対応するエンドポイントを定義。
- **Base URL**: 実行時に変更可能。設定画面で保存した URL を Hilt の提供元（例: ApiServiceProvider）で使い、Retrofit の `baseUrl()` に渡す。

## エンドポイント対応（現在実装分）

Backend の [API_SPEC.md](../backend/API_SPEC.md) に合わせた対応一覧。未実装のものは必要に応じて ApiService に追加する。

- **Auth**: `POST api/auth/login`, `POST api/auth/register`, `GET api/auth/me`
- **Projects**: `GET api/projects`, `GET api/projects/{id}`, `POST api/projects`
  - **関連活動（N:N）**: `GET api/projects/{id}/activities`（権限 `projects.activities` use。応答は `ActivityDto[]` に `projects: {id,name,identifier}[]` を含む）, `POST api/projects/{id}/activities`（Body `{ activityId }`、権限 `companies.activities` input。活動の企業が当該プロジェクトの主企業または関連企業であること。不一致は 400）, `DELETE api/projects/{id}/activities/{activityId}`（同権限）。
- **Issues**: `GET api/issues`（Query: projectId, statusId, trackerId, priorityId, assignedToId, assignedToGroupId）, `GET api/issues/{id}`, `POST api/issues`, `PUT api/issues/{id}`, `DELETE api/issues/{id}`, `GET api/issues/meta/options`, `POST api/issues/{id}/comments`
  - レスポンスに `parentId`（親チケットID）, `parent`（`{id, subject}`）, `children`（`{id, subject, startDate, endDate, dueDate, parentId, statusId}[]`）, `_count.children`（子件数）, `endDate`（終了日）を含む。
  - **子チケットを持つチケットの `startDate`/`endDate`/`statusId` はサーバ集約値**（子孫の最小開始日・最大終了日・position最小のステータス）。これらのキーを直接送ると 400 になるため、クライアントは該当キー自体を送らない。Gson はデフォルト設定（`serializeNulls()` 未使用）で Kotlin `null` フィールドを JSON に出力しないため、「キーを送らない」は `null` を代入するだけで実現できる。
  - **`parentId` の解除**（親を「なし」に変更）だけは明示的な JSON `null` が必要なため、`UpdateIssueRequest.parentId` は `Int?` ではなく `JsonElement?` 型（`parentIdBody(value: Int?)` ヘルパーで生成）。
  - `POST`/`PUT` の Body に `parentId`（作成・変更）、`endDate` を追加。`parentId` の変更は権限 `projects.issues.fields.parent` の input が必要（403 の場合はエラーメッセージを表示）。
  - `GET api/issues/meta/options` の `groups` に `members`（`{userId}[]`）を含む（担当者グループ選択時のメンバー展開に使用）。
  - **チケット一覧・カンバンのフィルタ（トラッカー／ステータス／優先度／担当者／担当グループ／期日レンジ）はすべてクライアント側で行う**（web と同方式）。サーバへは `projectId` のみを渡して全件取得し、`ui/utils/IssueFilterUtils.kt` で絞り込む。
- **Time Entries**: `GET api/time-entries`（Query: projectId, userId）, `POST api/time-entries`, `PUT api/time-entries/{id}`, `DELETE api/time-entries/{id}`
- **Companies**: `GET api/companies`, `GET api/companies/{id}`, `POST api/companies`（作成）, `PUT api/companies/{id}`（更新）, `DELETE api/companies/{id}`（削除）, `GET api/companies/{companyId}/locations`, `POST api/companies/{companyId}/locations`, `GET api/companies/{companyId}/wiki`（会社 Wiki 一覧）, `GET api/companies/{companyId}/comments`（会社コメント一覧）, `POST api/companies/{companyId}/comments`（コメント追加）
- **Admin**: `GET api/admin/legal-entity-statuses`（法人区分一覧。会社作成・編集時の選択肢に利用）
- **企業統合**: `POST api/companies/{id}/merge`（Body: `{ targetCompanyId }`）— `{id}`（統合元）を `targetCompanyId`（統合先）に統合する。統合元の拠点・連絡先・商談・活動・コメント・Wiki・関連付けが統合先に付け替えられ、統合元は削除される。レスポンス `200 { mergedIntoId, message }`。**不可逆操作**。権限 `companies.merge` input（403 の場合はエラー表示）。400: 同一ID指定・パラメータ不正。404: 企業が存在しない。
- **CRM**: `GET api/crm/contacts`（Query: companyId）, `POST api/crm/contacts`, `GET api/crm/deals`（Query: companyId）, `POST api/crm/deals`, `GET api/crm/activities`（Query: companyId）, `POST api/crm/activities`
  - `GET api/crm/contacts` / `GET api/crm/deals` は `page` を指定するとページング応答 `{ items, total, page, pageSize, totalPages }` を返す（`pageSize` 省略時 50、`q` で氏名・企業名等を部分一致検索、`companyId` 省略で全社横断）。`page` 未指定時は従来通り配列（企業詳細タブ用）。全社横断一覧（`ContactsListScreen`/`DealsListScreen`）はページング版を使用し、企業詳細タブは既存の配列版を使用する。
  - ページング版の `ContactDto`/`DealDto` は `company: { id, name }` を含む（全社横断一覧での企業名表示用）。`DealDto` はさらに `contact`（`{id, firstName, lastName}`）、`assignedTo`（`UserRefDto`）を含む。
  - `GET api/crm/deals` は権限 `deals` use が必要（403 の場合はエラー表示）。
- **Wiki（プロジェクト）**: `GET api/wiki/project/{projectId}`（一覧）, `GET api/wiki/{pageId}`（ページ取得）
- **Saved Searches**: `GET api/saved-searches?viewMode=`（`viewMode` 必須: `list`|`gantt`|`kanban`|`time`）, `POST api/saved-searches`（Body `{viewMode, name, filter, isDefault?}`）, `PUT api/saved-searches/{id}`（Body `{name?, filter?, isDefault?}`）, `DELETE api/saved-searches/{id}`（204）。認証のみ（権限コードなし。`projects.saved-searches` は UI 側の canInput 判定用）。
  - **Android が使う viewMode は `list`（チケット一覧）と `kanban`（カンバン）のみ**。`gantt`・`time` は使わない。
  - `filter` は Prisma 上不透明な JSON のため Android 独自の形状（`IssueFilterCriteria` をシリアライズしたもの）で問題ないが、**同一ユーザーの web 側保存済み検索と同じ一覧に混在する**ため、保存時に必ず `"client": "android"` をトップレベルに含め、一覧表示時は `filter.client == "android"` のものだけを表示する（web の条件を誤って適用しないため）。Kotlin 側の型は `com.google.gson.JsonObject`（データクラス化しない）。
- **Gantt**: `GET api/gantt/project/{projectId}` — レスポンス `{ project: { id, name, dueDate, parentId }, issues: IssueDto[] }`。`issues` は親の開始・終了・ステータスがサーバ側で子孫から集約済み（クライアント側での再集約は不要）。日付未設定のチケットも行として含まれる。権限 `projects.gantt` use（403 の場合は「ガントの閲覧権限がありません」と表示）。`GET api/gantt/all`（全プロジェクト横断）はモバイルでは未使用。

## 認証ヘッダー

- OkHttp の Interceptor で、保存済みトークンがあれば `Authorization: Bearer <token>` を付与。トークンは PreferencesManager 等で読み書き。
- 401 レスポンス時はトークンを削除し、ログイン画面へ遷移する処理をアプリ側で行う（必要に応じて Interceptor または Repository で実装）。

## Repository 層

- 各機能ごとに Repository（例: AuthRepository, ProjectRepository, IssueRepository, TimeRepository, CompanyRepository, Wiki 用）が ApiService を呼び出し、ViewModel は Repository を経由して API を利用する。
- ApiServiceProvider などで Base URL 変更時に Retrofit インスタンスを再生成し、Repository に注入し直す構成を推奨。

## データモデル（DTO）

- **ファイル**: `data/api/models/*.kt`（AuthModels, ProjectModels, IssueModels, TimeModels, CompanyModels 等）
- Backend のレスポンス形状および [DATA_MODEL.md](../backend/DATA_MODEL.md) に合わせて定義。日付は String（ISO 8601）で受け取り、画面でフォーマットする。
- **CompanyDto / CreateCompanyRequest / UpdateCompanyRequest** には `fax: String?` フィールドが含まれる。

## Base URL 設定

- エミュレータ: `http://10.0.2.2:3000`（ホストの localhost）
- 実機: 同一 Wi‑Fi の PC の IP（例: `http://192.168.1.10:3000`）。設定画面で保存し、次回起動時から利用する。
- 詳細は [BUILD.md](../../android/doc/BUILD.md) の「バックエンドへの接続設定」を参照。
