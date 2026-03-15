# ProjectHub Android アプリ ビルド・デバッグ手順

## 目次

1. [前提条件](#前提条件)
2. [開発環境のセットアップ](#開発環境のセットアップ)
3. [プロジェクトのビルド](#プロジェクトのビルド)
4. [ワイヤレスデバッグ（実機）](#ワイヤレスデバッグ実機)
5. [バックエンドへの接続設定](#バックエンドへの接続設定)
6. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

| 必要なもの | バージョン |
|-----------|-----------|
| Android Studio | Hedgehog (2023.1.1) 以降 |
| JDK | 17 以上 |
| Android SDK | API 35 (compileSdk) |
| Android SDK (最低) | API 26 (minSdk = Android 8.0) |
| 実機 Android OS | 11 以上（ワイヤレスデバッグ対応） |

---

## 開発環境のセットアップ

### 1. Android Studio のインストール

[https://developer.android.com/studio](https://developer.android.com/studio) からダウンロードしてインストールします。

### 2. SDK のインストール

Android Studio 起動後、以下を確認・インストールします。

```
Android Studio > Settings > Languages & Frameworks > Android SDK
```

- **SDK Platforms タブ**: Android 14 (API 35) にチェック
- **SDK Tools タブ**: 以下にチェック
  - Android SDK Build-Tools 35
  - Android SDK Platform-Tools
  - Android Emulator（任意）

### 3. プロジェクトを開く

```
Android Studio > File > Open
```

`projecthub/android/` フォルダを選択して開きます。

### 4. Gradle Sync の実行

プロジェクトを開くと自動で Gradle sync が始まります。完了まで待ちます。
手動で実行する場合:

```
File > Sync Project with Gradle Files
```

---

## プロジェクトのビルド

### デバッグビルド（開発用）

```bash
# プロジェクトルート（android/）で実行
./gradlew assembleDebug
```

APK の出力先:
```
app/build/outputs/apk/debug/app-debug.apk
```

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

## ワイヤレスデバッグ（実機）

Android 11 以降の実機で、USB ケーブルなしでデバッグできます。
**PCと実機が同じ Wi-Fi ネットワークに接続されている**ことが前提です。

---

### 方法 A: Android Studio の Wi-Fi ペアリング（推奨）

#### ステップ 1: 実機の開発者オプションを有効化

1. 設定 → 端末情報 → ビルド番号を **7回タップ**
2. 「開発者になりました」と表示される

#### ステップ 2: ワイヤレスデバッグを有効化

1. 設定 → 開発者向けオプション → **ワイヤレスデバッグ** をオン
2. 「ワイヤレスデバッグ」をタップ → **QRコードでデバイスをペアリング** をタップ

#### ステップ 3: Android Studio でペアリング

1. Android Studio のメニューバー右上のデバイスセレクターをクリック
2. **Pair Devices Using Wi-Fi** をクリック
3. 表示された QR コードを実機でスキャン
4. ペアリング成功後、デバイスが一覧に表示される

#### ステップ 4: アプリをデプロイ

1. デバイスセレクターで実機を選択
2. **Run ▶ ボタン** をクリック（または `Shift+F10`）
3. アプリが実機にインストールされてデバッグモードで起動

---

### 方法 B: adb コマンドでのワイヤレス接続

#### ステップ 1: 初回のみ USB 接続でペアリング（Android 10 以前の方法）

```bash
# USB でデバイスを接続後
adb devices
# → デバイスが表示されることを確認

# TCPモードに切り替え（ポート5555）
adb tcpip 5555
```

#### ステップ 2: Wi-Fi IP アドレスの確認

実機で確認:
```
設定 → 一般 → Wi-Fi → 接続中のネットワーク詳細 → IP アドレス
```

または adb で確認:
```bash
adb shell ip addr show wlan0 | grep inet
```

#### ステップ 3: ワイヤレス接続

```bash
# USB ケーブルを抜いてから実行
adb connect <実機のIPアドレス>:5555

# 例
adb connect 192.168.1.5:5555
```

#### ステップ 4: 接続確認

```bash
adb devices
# → 192.168.1.5:5555  device  と表示されれば成功
```

#### ステップ 5: APK のインストール & 起動

```bash
# デバッグ APK をビルド＆インストール
./gradlew installDebug

# またはビルド済み APK を直接インストール
adb install app/build/outputs/apk/debug/app-debug.apk

# アプリを起動
adb shell am start -n com.projecthub.android/.MainActivity
```

---

### 方法 C: Android 11 以降の adb pair コマンド（USBなし）

#### ステップ 1: 実機でペアリングコードを表示

```
設定 → 開発者向けオプション → ワイヤレスデバッグ → ペアリングコードでデバイスをペアリング
```

ポート番号（例: `37001`）と 6 桁のコードが表示される。

#### ステップ 2: adb pair で接続

```bash
adb pair <実機のIPアドレス>:<ペアリングポート>
# 例
adb pair 192.168.1.5:37001
# → ペアリングコードの入力を求められる
# → 6桁のコードを入力して Enter
```

#### ステップ 3: デバッグ接続

ペアリング後、ワイヤレスデバッグ画面に表示されている **IPアドレスとポート**（ペアリングとは別のポート）で接続:

```bash
adb connect <実機のIPアドレス>:<デバッグポート>
# 例
adb connect 192.168.1.5:39517
```

#### ステップ 4: 接続確認・デプロイ

```bash
adb devices
# → 接続確認

./gradlew installDebug
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

```bash
# adb サーバーを再起動
adb kill-server
adb start-server
adb devices
```

### ワイヤレス接続が切れる

```bash
# 再接続
adb connect <IPアドレス>:5555

# それでも繋がらない場合は USB で接続後に再設定
adb tcpip 5555
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
adb logcat

# ProjectHub アプリのログのみ
adb logcat --pid=$(adb shell pidof com.projecthub.android)

# タグでフィルタ
adb logcat -s ProjectHub:D OkHttp:D
```

---

## よく使う開発コマンド一覧

```bash
# ビルド
./gradlew assembleDebug

# インストール
./gradlew installDebug

# アンインストール
adb uninstall com.projecthub.android

# ログ表示
adb logcat -s ProjectHub:D

# スクリーンショット
adb exec-out screencap -p > screenshot.png

# 接続デバイス確認
adb devices

# アプリ強制停止
adb shell am force-stop com.projecthub.android

# アプリデータ消去（ログアウト状態にリセット）
adb shell pm clear com.projecthub.android
```
