package com.projecthub.android.ui.companies

import android.app.Activity
import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.SCANNER_MODE_FULL
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions

// ─── 内部状態モデル ─────────────────────────────────────────────────────────────

private data class ScannedPage(
    val imageUri: Uri,
    val cardInfo: BusinessCardInfo? = null,
    val isProcessing: Boolean = true,
)

// ─── メイン画面 ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessCardScanScreen(
    onNavigateBack: () -> Unit,
    legalEntityNames: List<String> = emptyList(),
) {
    val context = LocalContext.current
    val scannedPages = remember { mutableStateListOf<ScannedPage>() }
    var scanLaunched by remember { mutableStateOf(false) }
    var scannerError by remember { mutableStateOf<String?>(null) }

    // ── Document Scanner クライアント ─────────────────────────────────────────
    val scanner = remember {
        val options = GmsDocumentScannerOptions.Builder()
            .setScannerMode(SCANNER_MODE_FULL)
            .setGalleryImportAllowed(true)
            .setPageLimit(20)
            .setResultFormats(RESULT_FORMAT_JPEG)
            .build()
        GmsDocumentScanning.getClient(options)
    }

    // ── スキャン結果ランチャー ──────────────────────────────────────────────────
    val scannerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val pages = GmsDocumentScanningResult
                .fromActivityResultIntent(result.data)
                ?.pages
                .orEmpty()

            // まず全ページを "処理中" で追加
            pages.forEach { page ->
                scannedPages.add(ScannedPage(imageUri = page.imageUri))
            }
            // 各ページの OCR を非同期で実行
            pages.forEach { page ->
                runOcr(context, page.imageUri, legalEntityNames) { cardInfo ->
                    val idx = scannedPages.indexOfFirst { it.imageUri == page.imageUri }
                    if (idx >= 0) {
                        scannedPages[idx] = scannedPages[idx].copy(
                            cardInfo = cardInfo,
                            isProcessing = false,
                        )
                    }
                }
            }
        } else if (scannedPages.isEmpty()) {
            // キャンセルかつスキャン済みページが無い場合は前画面へ
            onNavigateBack()
        }
    }

    // ── 画面表示時にスキャナーを自動起動 ─────────────────────────────────────
    LaunchedEffect(Unit) {
        if (!scanLaunched) {
            scanLaunched = true
            val activity = context as? Activity
            if (activity == null) {
                scannerError = "スキャナーを起動できませんでした"
                return@LaunchedEffect
            }
            scanner.getStartScanIntent(activity)
                .addOnSuccessListener { intentSender ->
                    scannerLauncher.launch(
                        IntentSenderRequest.Builder(intentSender).build(),
                    )
                }
                .addOnFailureListener { e ->
                    scannerError = "スキャナーの起動に失敗しました: ${e.localizedMessage}"
                }
        }
    }

    // ── UI ──────────────────────────────────────────────────────────────────
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("名刺スキャン") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
            )
        },
    ) { paddingValues ->
        when {
            scannerError != null -> {
                // エラー表示
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = scannerError!!,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onNavigateBack) { Text("戻る") }
                    }
                }
            }

            scannedPages.isEmpty() -> {
                // スキャン待機中
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("スキャナーを起動中...", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            else -> {
                // スキャン結果一覧
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    itemsIndexed(scannedPages) { index, page ->
                        ScannedPageItem(index = index + 1, page = page)
                    }
                }
            }
        }
    }
}

// ─── スキャン済み1ページの表示 ────────────────────────────────────────────────

@Composable
private fun ScannedPageItem(index: Int, page: ScannedPage) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "書類 $index",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )

        // スキャン画像
        AsyncImage(
            model = page.imageUri,
            contentDescription = "スキャン画像 $index",
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 160.dp, max = 320.dp)
                .clip(RoundedCornerShape(8.dp))
                .border(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outlineVariant,
                    shape = RoundedCornerShape(8.dp),
                ),
            contentScale = ContentScale.Fit,
        )

        // 名刺情報
        when {
            page.isProcessing -> {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text("文字を認識中...", style = MaterialTheme.typography.bodySmall)
                }
            }

            page.cardInfo != null -> {
                BusinessCardInfoCard(cardInfo = page.cardInfo)
            }

            else -> {
                Text(
                    text = "名刺情報を取得できませんでした",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        HorizontalDivider()
    }
}

// ─── 名刺情報カード ────────────────────────────────────────────────────────────

@Composable
private fun BusinessCardInfoCard(cardInfo: BusinessCardInfo) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // 氏名
            val fullName = listOfNotNull(cardInfo.lastName, cardInfo.firstName)
                .joinToString(" ").ifBlank { null }
            if (fullName != null) {
                CardInfoRow(icon = Icons.Default.Person, label = "氏名", value = fullName)
            }

            // 役職
            cardInfo.jobTitle?.let {
                CardInfoRow(icon = Icons.Default.Work, label = "役職", value = it)
            }

            // 会社名（法人格付き）
            val companyFull = buildCompanyFullName(cardInfo)
            if (companyFull != null) {
                CardInfoRow(icon = Icons.Default.Business, label = "会社名", value = companyFull)
            }

            // 拠点名
            cardInfo.officeName?.let {
                CardInfoRow(icon = Icons.Default.LocationOn, label = "拠点名", value = it)
            }

            // 電話番号
            cardInfo.phoneNumber?.let {
                CardInfoRow(icon = Icons.Default.Phone, label = "電話", value = it)
            }

            // メールアドレス
            cardInfo.email?.let {
                CardInfoRow(icon = Icons.Default.Email, label = "メール", value = it)
            }

            if (fullName == null && cardInfo.jobTitle == null && companyFull == null &&
                cardInfo.officeName == null && cardInfo.phoneNumber == null && cardInfo.email == null
            ) {
                Text(
                    text = "名刺情報を抽出できませんでした",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun CardInfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "$label: ",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.widthIn(min = 48.dp),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
        )
    }
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

/** 法人格と会社名を結合してフル会社名を生成 */
private fun buildCompanyFullName(cardInfo: BusinessCardInfo): String? {
    val company = cardInfo.companyName ?: return cardInfo.legalEntityName
    val entity = cardInfo.legalEntityName ?: return company
    return when (cardInfo.legalEntityPosition) {
        "前" -> "$entity$company"
        "後" -> "$company$entity"
        else -> "$entity$company"
    }
}

/**
 * 指定 URI の画像に対して ML Kit Japanese OCR を実行し、
 * [BusinessCardParser] で解析した結果をコールバックで返す。
 * コールバックは ML Kit のスレッドから呼ばれるが、UI 更新は Compose の
 * [SnapshotStateList] 経由でスレッドセーフに反映される。
 */
private fun runOcr(
    context: Context,
    imageUri: Uri,
    legalEntityNames: List<String>,
    onResult: (BusinessCardInfo?) -> Unit,
) {
    try {
        val recognizer = TextRecognition.getClient(
            JapaneseTextRecognizerOptions.Builder().build(),
        )
        val inputImage = InputImage.fromFilePath(context, imageUri)
        recognizer.process(inputImage)
            .addOnSuccessListener { text ->
                onResult(BusinessCardParser.parse(text, legalEntityNames))
            }
            .addOnFailureListener {
                onResult(null)
            }
    } catch (e: Exception) {
        onResult(null)
    }
}
