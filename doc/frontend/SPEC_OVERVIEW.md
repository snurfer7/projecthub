# Frontend 仕様概要

## 目的

ProjectHub の Web クライアント。プロジェクト・チケット・Wiki・ガント・工数・会社・CRM・管理機能を一つの SPA で提供する。

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | React |
| ビルド | Vite |
| ルーティング | React Router v6 |
| HTTP クライアント | Axios |
| 認証 | JWT（localStorage に token / user を保存） |

## アーキテクチャ

- **エントリ**: `main.tsx` → `App.tsx`
- **認証**: `useAuth` で token/user を管理。未認証時は `/login` または `/register` のみ表示。
- **レイアウト**: 認証済みは `Layout` でラップし、サイドナビ・ユーザーメニューを表示。
- **API**: `api/client.ts` の axios インスタンスで Base URL `/api`、要認証リクエストに `Authorization: Bearer <token>` を付与。401 時は localStorage をクリアして `/login` へリダイレクト。

## 認証フロー

1. 初回: token なし → `App` で `user` が null → `/login` または `/register` を表示。
2. ログイン/登録成功: レスポンスの `token` と `user` を localStorage に保存 → `useAuth` が `user` を返す → `Layout` + 各ルートを表示。
3. ランディング: `/` で `user.landingPage` に応じて `/home` / `/projects`（従来の `gantt` は `/projects?view=gantt`）/ `/companies` にリダイレクト。
4. ログアウト: token/user を削除 → 未認証状態となり `/login` へ。

## メニュー表示制御

`user.showProjectsMenu`, `showGanttMenu`, `showCompanyMenu`, `showAdminMenu` でサイドメニュー項目の表示/非表示を制御。設定は `PUT /api/auth/menu-settings` で更新。

## 関連パス

- ページ: `frontend/src/pages/*.tsx`
- コンポーネント: `frontend/src/components/*.tsx`
- 型: `frontend/src/types/index.ts`
- API: `frontend/src/api/client.ts`
- 認証フック: `frontend/src/hooks/useAuth.ts`
