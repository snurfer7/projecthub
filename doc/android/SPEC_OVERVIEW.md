# Android 仕様概要

## 目的

ProjectHub のネイティブ Android クライアント。Web フロントエンドと同様に、プロジェクト・チケット・Wiki・工数・会社を扱い、モバイル向けにホーム・プロジェクト・チケット・工数・会社の 5 タブ + 設定で利用する。

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | Kotlin |
| UI | Jetpack Compose |
| DI | Hilt |
| ナビゲーション | Navigation Compose |
| HTTP | Retrofit + OkHttp |
| 認証 | JWT（Bearer）。トークンは PreferencesManager 等で保持 |
| ドキュメントスキャン | ML Kit Document Scanner (`play-services-mlkit-document-scanner`) |
| 文字認識 | ML Kit Text Recognition v2 Japanese (`text-recognition-japanese`) |
| 画像表示 | Coil (`coil-compose`) |

## アーキテクチャ

- **エントリ**: ProjectHubApp → NavHost（NavGraph）。
- **認証状態**: AuthViewModel でログイン状態を保持。未ログイン時は Login/Register のみ。ログイン後は MainScaffold（BottomNav）＋各画面。
- **画面**: 各機能ごとに `*Screen.kt` と `*ViewModel.kt` を配置。Repository が ApiService を呼び出し、ViewModel が UI 状態を保持。
- **API Base URL**: 設定画面で変更可能。デフォルトはエミュレータでは `10.0.2.2:3000`、実機では同一 Wi‑Fi の PC の IP を指定。

## 認証・設定

- ログイン/登録: ApiService の `login` / `register` を呼び、レスポンスの token を保存。以降の API は Retrofit の Interceptor で `Authorization: Bearer <token>` を付与。
- 設定画面で API Base URL の変更・ログアウトを実行。ログアウト時はトークン削除し、NavGraph の startDestination を Login に切り替える。

## UI・フォーム

- **日付項目**: 期限日・開始日・作業日・見込み日・期日などは、タップでシステム標準の DatePicker ダイアログ（Material3）を表示して選択する。値は API 用に "yyyy-MM-dd" 形式で保持。

## 名刺スキャン機能

- **プレスキャンガイド**: `BusinessCardGuideScreen` を起動直後に表示。CameraX（`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`）でライブプレビューを映しながら 2 種類のリアルタイム解析を行い、案内メッセージをオーバーレイ表示する。
  - **輝度チェック（毎フレーム）**: YUV_420_888 の Y プレーン平均が 70 未満 → 「明るい場所で撮影してください」（赤）
  - **距離チェック（800ms スロットリング、ML Kit テキスト検出）**: テキストブロックが未検出 → 「名刺をフレーム内に合わせてください」（白）。すべてのブロック高さが画像高さの 3% 未満 → 「もう少し近づけてください」（橙）。適切な大きさのブロックを検出 → 「この状態でスキャンできます」（緑）。
  - 状態列挙: `ScanGuideState`（`CHECKING` / `TOO_DARK` / `TOO_FAR` / `READY`）
  - カメラ権限（`android.permission.CAMERA`）を `ActivityResultContracts.RequestPermission()` で動的にリクエスト。未許可時は許可要求 UI を表示。
  - 「スキャン開始」ボタンをタップすると GmsDocumentScanning を起動し、結果一覧表示に切り替わる。2 枚目以降の追加スキャン（FAB）はガイド画面をスキップして直接スキャナーを起動。
- **スキャン**: `GmsDocumentScanningOptions` でマルチページ (SCANNER_MODE_FULL, RESULT_FORMAT_JPEG, pageLimit=20) を設定し、`GmsDocumentScanning.getClient()` でスキャナーを起動。
- **複数枚対応（1画像内）**: OCR 結果の `TextBlock` を座標ベースでクラスタリングし、1 枚のスキャン画像から複数名刺を自動検出して個別にパースする。クラスタリングは縦方向・横方向の大きな空白（テキストブロック高さ中央値の 3 倍以上のギャップ）を境界として分割する。
- **スキャン追加**: スキャン結果一覧画面の右下に「スキャン追加」FAB（DocumentScanner アイコン）を表示し、タップで再度スキャナーを起動して結果を既存リストに追記できる。
- **OCR**: スキャン済み画像 URI ごとに `InputImage.fromFilePath()` で入力し、`TextRecognition.getClient(JapaneseTextRecognizerOptions)` で文字認識。
- **パース**: `BusinessCardParser.parseBlocks(blocks, legalEntityNames)` でクラスタごとに `BusinessCardInfo` へ変換。法人格リストは `CompanyViewModel.listUiState.legalEntityStatuses` から取得。
  - FAX 番号: `FAX`/`ファックス`/`ファクス` キーワードを含む行から抽出。`TEL/FAX` 兼用行は電話番号として扱いFAXは抽出しない。
  - 郵便番号: `〒XXX-XXXX` または `XXX-XXXX` 形式（全角数字を許容）の行から抽出。
  - 住所: 郵便番号行の後続テキストまたは次の行、あるいは都道府県キーワード（都/道/府/県）を含む行を住所として抽出。
- **表示**: スキャン画像 1 枚から複数名刺が検出された場合、画像の下に「検出 1 / N」「検出 2 / N」のようにサブラベル付きで並べて表示する。
- **配置**: `ui/companies/BusinessCardScanScreen.kt`, `ui/companies/BusinessCardGuideScreen.kt`, `ui/companies/BusinessCardParser.kt`, `ui/companies/BusinessCardInfo.kt`

## 関連パス

- ナビ: `ui/navigation/NavGraph.kt`
- 画面: `ui/auth/`, `ui/home/`, `ui/projects/`, `ui/issues/`, `ui/kanban/`, `ui/wiki/`, `ui/timeentries/`, `ui/companies/`, `ui/settings/`
- 共通コンポーネント: `ui/components/`（日付選択は `DatePickerField.kt`）
- データ: `data/api/ApiService.kt`, `data/api/models/*.kt`, `data/repository/*.kt`, `data/local/PreferencesManager.kt`
- DI: `di/AppModule.kt`
