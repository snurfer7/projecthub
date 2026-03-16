# ProjectHub - Claude Code ルール

## 仕様駆動開発ルール

### 実装前の必須確認

新機能追加・既存機能変更の際は、**実装前に必ず該当 doc を参照すること**。

| 作業対象 | 参照すべきドキュメント |
|---------|----------------------|
| Web フロントエンド | [doc/frontend/](doc/frontend/) |
| API サーバー (バックエンド) | [doc/backend/](doc/backend/) |
| Android アプリ | [doc/android/](doc/android/) |

各領域の参照順:
1. `SPEC_OVERVIEW.md` — 機能概要・要件
2. 領域固有の仕様ファイル（`API_SPEC.md`, `SCREENS_AND_ROUTES.md` 等）
3. `DATA_MODEL.md` / `DATA_MODELS.md` — データ構造

### 仕様変更時のルール（必須）

仕様変更を伴う実装の場合、**ドキュメントを先に更新してから実装すること**。

手順:
1. 変更内容を該当 doc に反映する
2. doc の変更をコミットまたはステージングする
3. その後、実装を行う

> doc と実装が乖離した状態でのコミットは禁止。

### ドキュメント構成

```
doc/
├── README.md                         # doc 全体の説明
├── LIGHTSAIL_DEPLOYMENT.md           # デプロイ手順
├── frontend/
│   ├── SPEC_OVERVIEW.md              # フロントエンド仕様概要
│   ├── SCREENS_AND_ROUTES.md         # 画面・ルート一覧
│   ├── DATA_MODELS.md                # 型定義
│   └── API_USAGE.md                  # API 利用仕様
├── backend/
│   ├── SPEC_OVERVIEW.md              # バックエンド仕様概要
│   ├── API_SPEC.md                   # API 仕様（契約）
│   └── DATA_MODEL.md                 # Prisma データモデル
└── android/
    ├── SPEC_OVERVIEW.md              # Android 仕様概要
    ├── SCREENS_AND_NAVIGATION.md     # 画面・ナビゲーション
    └── API_INTEGRATION.md            # API 連携仕様
```

### API 契約

- `doc/backend/API_SPEC.md` を API 契約として扱う
- フロントエンド・Android はこの仕様に従って実装する
- API の追加・変更時は必ず `API_SPEC.md` を先に更新する
