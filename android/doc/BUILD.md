# ProjectHub Android アプリ ビルド・デプロイ手順

## 目次

1. [実機へのデプロイ（推奨）](#実機へのデプロイ推奨)
2. [エミュレーターでのデバッグ（WSL2 + Windows）](#エミュレーターでのデバッグwsl2--windows)
3. [プロジェクトのビルド](#プロジェクトのビルド)
4. [バックエンドへの接続設定](#バックエンドへの接続設定)
5. [トラブルシューティング](#トラブルシューティング)
6. [補足: 前提条件・開発環境のセットアップ](#補足-前提条件開発環境のセットアップ)
7. [補足: ワイヤレスデバッグの初期セットアップ](#補足-ワイヤレスデバッグの初期セットアップ)
8. [補足: よく使うADBコマンド](#補足-よく使うadbコマンド)

---

## 実機へのデプロイ（推奨）

プロジェクトルート（`projecthub/`）で `scripts/deploy_device.sh` を実行すると、ビルド → インストール → 起動までを自動で行います。
Windows側の `adb.exe` を直接呼び出すため、ADBサーバーの二重起動を避けられます。

> スクリプト類は `projecthub/scripts/` に集約されています。以降のコマンドはすべてプロジェクトルートで実行してください。

### USB接続

```bash
./scripts/deploy_device.sh
```

実機をUSBでPCに接続してください。「USBデバッグを許可」ダイアログが出たら許可すると、自動で検出・ビルド・インストール・起動まで進みます。

### ワイヤレス接続

```bash
./scripts/deploy_device.sh --wireless
```

初回はペアリングコードの入力が必要です（スクリプトの指示に従って入力してください）。2回目以降は接続済みの端末が候補として表示され、選ぶだけで接続できます。IP:PORTが分かっていれば直接指定も可能です:

```bash
./scripts/deploy_device.sh --wireless 192.168.1.5:39517
```

実機のワイヤレスデバッグを初めて有効化する場合は、[補足: ワイヤレスデバッグの初期セットアップ](#補足-ワイヤレスデバッグの初期セットアップ) を参照してください。

### オプション

| オプション | 説明 |
|-----------|------|
| `--wireless [IP:PORT]` | USBの代わりにWi-Fi接続を使う |
| `--no-launch` | インストールのみ行い、アプリを起動しない |
| `-h`, `--help` | ヘルプを表示 |

---

## エミュレーターでのデバッグ（WSL2 + Windows）

WSL2でビルドし、Windowsホスト側のAndroid Studioエミュレーターにデプロイする方法です。実機ではなくエミュレーターを使う場合はこちらを使います。
`debug.sh` スクリプトで一連の操作をまとめています。

### 事前準備（初回のみ）

#### 1. Windows側でADBをTCP接続待受に設定

エミュレーターを起動した状態で、Windowsのコマンドプロンプト（またはPowerShell）で実行:

```powershell
adb tcpip 5555
adb connect localhost:5555
```

#### 2. Windowsファイアウォールでポート5555を許可

PowerShellを管理者権限で実行:

```powershell
New-NetFirewallRule -DisplayName "ADB WSL2" -Direction Inbound -Protocol TCP -LocalPort 5555 -Action Allow
```

### debug.sh の使い方

プロジェクトルート（`projecthub/`）で実行します。

```bash
./scripts/debug.sh status      # 接続状態・デバイス情報の確認
./scripts/debug.sh connect     # WindowsエミュレーターにADB接続
./scripts/debug.sh run         # ビルド → インストール → アプリ起動（デフォルト動作）
./scripts/debug.sh build       # デバッグビルドのみ
./scripts/debug.sh install     # ビルド & インストール
./scripts/debug.sh logcat      # アプリのLogcatを表示（Ctrl+C で終了）
./scripts/debug.sh clear-log   # Logcatをクリア
./scripts/debug.sh uninstall   # アプリをアンインストール
./scripts/debug.sh disconnect  # ADB接続を切断
./scripts/debug.sh help        # ヘルプ
```

> **仕組み**: WSL2はWindowsホストのIPを `/etc/resolv.conf` の nameserver から取得し、そのIP:5555 に ADB 接続します。Windows側の `adb.exe` を直接呼び出すため、ADBサーバーの二重起動を避けられます。

---

## プロジェクトのビルド

APKを生成するだけで、デプロイまでは不要な場合はこちら。`android/` ディレクトリで実行します（`gradlew` はAndroidプロジェクト側にあるため、`scripts/` ではありません）。

### デバッグビルド

```bash
./gradlew assembleDebug
```

APK の出力先: `app/build/outputs/apk/debug/app-debug.apk`

### リリースビルド

```bash
./gradlew assembleRelease
```

> **注意**: リリースビルドには署名設定が必要です。`app/build.gradle.kts` に `signingConfigs` を追加してください。

### ビルドのクリーン

ビルドエラーが発生した場合はクリーンを試みます。

```bash
./gradlew clean
./gradlew assembleDebug
```

---

## バックエンドへの接続設定

### エミュレータの場合

エミュレータからは `10.0.2.2` がホスト PC の localhost を指します。
デフォルトの接続先: `http://10.0.2.2:3000`

### 実機の場合（同一 Wi-Fi）

実機は PC の IP アドレスに直接アクセスします。

#### PC の IP アドレスを確認

**Linux/macOS:**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# または
hostname -I
```

**Windows:**
```powershell
ipconfig
# → Wi-Fi アダプターの IPv4 アドレスを確認
```

#### アプリ内で接続先を変更

1. アプリを起動
2. 画面右上の歯車アイコン → **設定** をタップ
3. **API Base URL** を変更:
   ```
   http://<PCのIPアドレス>:3000
   ```
   例: `http://192.168.1.10:3000`
4. **保存** をタップ → アプリが再接続

#### バックエンドの CORS 設定確認

バックエンドが実機からのリクエストを受け付けるよう、`backend/src/index.ts` の CORS 設定を確認してください。

```typescript
// 開発環境では全オリジンを許可している場合
app.use(cors());
```

#### バックエンドをすべてのインターフェースでリッスンさせる

`docker-compose.yml` または起動設定でバックエンドが `0.0.0.0:3000` でリッスンしていることを確認:

```yaml
# docker-compose.yml
ports:
  - "3000:3000"  # ホストの全インターフェースを公開
```

---

## トラブルシューティング

### Gradle Sync が失敗する

```bash
# キャッシュをクリアして再試行
./gradlew clean
rm -rf ~/.gradle/caches/

# または Android Studio から
File > Invalidate Caches > Invalidate and Restart
```

### adb でデバイスが認識されない

プロジェクトルートで実行します。

```bash
# adb サーバーを再起動
./scripts/adb-wrapper.sh kill-server
./scripts/adb-wrapper.sh start-server
./scripts/adb-wrapper.sh devices
```

### ワイヤレス接続が切れる

```bash
# 再接続（deploy_device.sh --wireless なら自動で再接続を案内します）
./scripts/adb-wrapper.sh connect <IPアドレス>:<ポート>
```

### アプリが「接続できません」エラーを出す

- PC のファイアウォールでポート 3000 が許可されているか確認
- バックエンドが起動しているか確認 (`http://<PC_IP>:3000/api/health`)
- アプリの設定画面で API URL が正しいか確認
- `http://` で始まっているか確認（`https://` は証明書が必要）

### ビルドエラー: `KSP` 関連

```bash
./gradlew clean assembleDebug --stacktrace
```

Hilt の KSP エラーが多い場合は `app/build.gradle.kts` の Kotlin バージョンと KSP バージョンの整合を確認してください。

| Kotlin | KSP |
|--------|-----|
| 1.9.22 | 1.9.22-1.0.17 |

### Logcat でログを確認

```bash
# 全ログ
./scripts/adb-wrapper.sh logcat

# ProjectHub アプリのログのみ
./scripts/adb-wrapper.sh logcat --pid=$(./scripts/adb-wrapper.sh shell pidof com.projecthub.android)

# タグでフィルタ
./scripts/adb-wrapper.sh logcat -s ProjectHub:D OkHttp:D
```

---

## 補足: 前提条件・開発環境のセットアップ

### 前提条件

| 必要なもの | バージョン |
|-----------|-----------|
| Android Studio | Hedgehog (2023.1.1) 以降 |
| JDK | 17 以上 |
| Android SDK | API 35 (compileSdk) |
| Android SDK (最低) | API 26 (minSdk = Android 8.0) |
| 実機 Android OS | 11 以上（ワイヤレスデバッグ対応） |

### セットアップ手順

1. **Android Studio のインストール**
   [https://developer.android.com/studio](https://developer.android.com/studio) からダウンロードしてインストール。

2. **SDK のインストール**
   `Android Studio > Settings > Languages & Frameworks > Android SDK` で以下を確認・インストール:
   - **SDK Platforms タブ**: Android 14 (API 35) にチェック
   - **SDK Tools タブ**: Android SDK Build-Tools 35 / Android SDK Platform-Tools / Android Emulator（任意）

3. **プロジェクトを開く**
   `Android Studio > File > Open` で `projecthub/android/` フォルダを選択。

4. **Gradle Sync の実行**
   プロジェクトを開くと自動で開始。手動実行する場合は `File > Sync Project with Gradle Files`。

---

## 補足: ワイヤレスデバッグの初期セットアップ

実機のワイヤレスデバッグを初めて使う場合、事前に端末側で以下を有効化しておく必要があります。
**PCと実機が同じ Wi-Fi ネットワークに接続されている**ことが前提です。

### ステップ 1: 開発者オプションを有効化

設定 → 端末情報 → ビルド番号を **7回タップ** →「開発者になりました」と表示される

### ステップ 2: ワイヤレスデバッグを有効化

設定 → 開発者向けオプション → **ワイヤレスデバッグ** をオン

この状態で `./scripts/deploy_device.sh --wireless` を実行すれば、以降のペアリング・接続はスクリプトが案内します。

### Android Studio の GUI でペアリングしたい場合

1. Android Studio のメニューバー右上のデバイスセレクターをクリック
2. **Pair Devices Using Wi-Fi** をクリック
3. 実機の「ワイヤレスデバッグ」画面で **QRコードでデバイスをペアリング** をタップし、表示されたQRコードをスキャン
4. ペアリング成功後、デバイスセレクターから選択して **Run ▶**（`Shift+F10`）でデプロイ

---

## 補足: よく使うADBコマンド

`adb` を直接実行すると WSL2 上に別の ADB サーバーが立ち上がり、Windows側の `adb.exe` と競合することがあります。以下のように `./scripts/adb-wrapper.sh`（Windows側の `adb.exe` を呼び出すラッパー、プロジェクトルートから実行）経由で実行してください。

```bash
# 接続デバイス確認
./scripts/adb-wrapper.sh devices

# アプリをアンインストール
./scripts/adb-wrapper.sh uninstall com.projecthub.android

# アプリ強制停止
./scripts/adb-wrapper.sh shell am force-stop com.projecthub.android

# アプリデータ消去（ログアウト状態にリセット）
./scripts/adb-wrapper.sh shell pm clear com.projecthub.android

# ログ表示
./scripts/adb-wrapper.sh logcat --pid=$(./scripts/adb-wrapper.sh shell pidof -s com.projecthub.android)

# スクリーンショット
./scripts/adb-wrapper.sh exec-out screencap -p > screenshot.png
```
