# ProjectHub - Claude Code ルール

仕様駆動開発のルールは [doc/README.md](doc/README.md) を参照すること。

**機能・項目の追加・変更時は、権限設定（PermissionResource / API `requirePermission` / フロントの `canUse`・`canInput`）もセットで実装すること。** 詳細は [doc/README.md](doc/README.md) の「権限設定を伴う実装」を参照。

**ユーザーから指示を受けたら、アドバイザーモードで実行すること。** まず Opus 5 をアドバイザーとして方針・設計・実装計画のレビューを行わせ、その計画に基づいて実装（コード編集）は Sonnet に行わせること。Agent ツールでサブエージェントを起動する際は `model` パラメータでそれぞれ `opus` / `sonnet` を明示的に指定する。
