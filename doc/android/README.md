# Android ドキュメント

Kotlin + Jetpack Compose + Hilt による Android アプリの仕様です。  
仕様駆動開発では **画面・ナビゲーション** と **API 連携** をここで定義・参照します。

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | アーキテクチャ、技術スタック、認証・設定 |
| [SCREENS_AND_NAVIGATION.md](SCREENS_AND_NAVIGATION.md) | 画面一覧、ルート、BottomNav、遷移 |
| [API_INTEGRATION.md](API_INTEGRATION.md) | ApiService、Repository、Base URL 設定 |

## ビルド・デバッグ

実機・エミュレータでのビルド、ワイヤレスデバッグ、バックエンド接続設定は以下を参照してください。

- [BUILD.md](../../android/doc/BUILD.md) — ビルド・デバッグ手順（`android/doc/BUILD.md`）

## 関連リポジトリパス

- ナビ: `android/app/src/main/java/.../ui/navigation/NavGraph.kt`
- 画面: `android/app/src/main/java/.../ui/**/*Screen.kt`
- API: `android/app/src/main/java/.../data/api/ApiService.kt`
- モデル: `android/app/src/main/java/.../data/api/models/*.kt`
