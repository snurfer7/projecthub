# Teams アプリ（Bot 1:1 通知）

Bot の 1:1 チャット投稿用マニフェストのサンプルです。手順の詳細は [MICROSOFT_SSO.md](../MICROSOFT_SSO.md) §5 を参照してください。

## パッケージ作成

1. 本ディレクトリの `manifest.json` を編集する
2. `color.png`（192×192）と `outline.png`（32×32）を用意する
3. 3 ファイルを ZIP にまとめ、Developer Portal または Teams 管理センターへアップロードする

## manifest.json で置き換える値

| 項目 | 値 |
|------|-----|
| `id` | Developer Portal の **Teams アプリ ID**（Entra クライアント ID とは別） |
| `bots[0].botId` | Entra **クライアント ID**（`MICROSOFT_CLIENT_ID`） |
| `webApplicationInfo.id` / `resource` | 同上 |
| `version` | 再公開のたびに上げる（例: `1.1.0` → `1.2.0`） |

## 推奨設定（1:1 通知のみ）

- `bots[0].scopes` は **`["personal"]` のみ**（`team` / `groupChat` を付けると `manifestVersion` 1.25 以上で `supportsChannelFeatures` が必須になり、検証でハマりやすい）
- `activities` セクションは Bot 方式では不要（旧アクティビティ通知用）
- `contentUrl` / `websiteUrl` は任意。タブで ProjectHub を開く場合のみ公開 https URL にする

## 関連

- 設定手順: [MICROSOFT_SSO.md §5](../MICROSOFT_SSO.md#5-teams-個人通知bot-11)
- Azure Bot: §5.3
- Developer Portal / 組織公開: §5.4–5.6
