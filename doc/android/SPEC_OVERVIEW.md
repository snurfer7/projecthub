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

## アーキテクチャ

- **エントリ**: ProjectHubApp → NavHost（NavGraph）。
- **認証状態**: AuthViewModel でログイン状態を保持。未ログイン時は Login/Register のみ。ログイン後は MainScaffold（BottomNav）＋各画面。
- **画面**: 各機能ごとに `*Screen.kt` と `*ViewModel.kt` を配置。Repository が ApiService を呼び出し、ViewModel が UI 状態を保持。
- **API Base URL**: 設定画面で変更可能。デフォルトはエミュレータでは `10.0.2.2:3000`、実機では同一 Wi‑Fi の PC の IP を指定。

## 認証・設定

- ログイン/登録: ApiService の `login` / `register` を呼び、レスポンスの token を保存。以降の API は Retrofit の Interceptor で `Authorization: Bearer <token>` を付与。
- 設定画面で API Base URL の変更・ログアウトを実行。ログアウト時はトークン削除し、NavGraph の startDestination を Login に切り替える。

## 関連パス

- ナビ: `ui/navigation/NavGraph.kt`
- 画面: `ui/auth/`, `ui/home/`, `ui/projects/`, `ui/issues/`, `ui/kanban/`, `ui/wiki/`, `ui/timeentries/`, `ui/companies/`, `ui/settings/`
- データ: `data/api/ApiService.kt`, `data/api/models/*.kt`, `data/repository/*.kt`, `data/local/PreferencesManager.kt`
- DI: `di/AppModule.kt`
