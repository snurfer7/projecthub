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
import androidx.compose.material.icons.filled.DocumentScanner
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
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions

// ─── 内部状態モデル ─────────────────────────────────────────────────────────────

private data class ScannedPage(
    val imageUri: Uri,
    val cardInfoList: List<BusinessCardInfo> = emptyList(),
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
    var showGuide by remember { mutableStateOf(true) }
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
                runOcr(context, page.imageUri, legalEntityNames) { cardInfoList ->
                    val idx = scannedPages.indexOfFirst { it.imageUri == page.imageUri }
                    if (idx >= 0) {
                        scannedPages[idx] = scannedPages[idx].copy(
                            cardInfoList = cardInfoList,
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

    // ── スキャナー起動ヘルパー ────────────────────────────────────────────────
    val launchScanner: () -> Unit = {
        val activity = context as? Activity
        if (activity == null) {
            scannerError = "スキャナーを起動できませんでした"
        } else {
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

    // ── プレスキャンガイド画面（初回スキャン前に表示） ──────────────────────
    if (showGuide) {
        BusinessCardGuideScreen(
            onStartScan = {
                showGuide = false
                launchScanner()
            },
            onNavigateBack = onNavigateBack,
        )
        return
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
        floatingActionButton = {
            if (scannedPages.isNotEmpty()) {
                FloatingActionButton(onClick = launchScanner) {
                    Icon(
                        Icons.Default.DocumentScanner,
                        contentDescription = "スキャン追加",
                    )
                }
            }
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
            text = "名刺 $index",
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

            page.cardInfoList.isEmpty() -> {
                Text(
                    text = "名刺情報を取得できませんでした",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            page.cardInfoList.size == 1 -> {
                BusinessCardInfoCard(cardInfo = page.cardInfoList[0])
            }

            else -> {
                // 複数名刺検出時はサブラベル付きで並べて表示
                val total = page.cardInfoList.size
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    page.cardInfoList.forEachIndexed { i, cardInfo ->
                        Text(
                            text = "検出 ${i + 1} / $total",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Medium,
                        )
                        BusinessCardInfoCard(cardInfo = cardInfo)
                    }
                }
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

            // FAX 番号
            cardInfo.faxNumber?.let {
                CardInfoRow(icon = Icons.Default.Phone, label = "FAX", value = it)
            }

            // メールアドレス
            cardInfo.email?.let {
                CardInfoRow(icon = Icons.Default.Email, label = "メール", value = it)
            }

            // 郵便番号
            cardInfo.postalCode?.let {
                CardInfoRow(icon = Icons.Default.LocationOn, label = "郵便番号", value = "〒$it")
            }

            // 住所
            cardInfo.address?.let {
                CardInfoRow(icon = Icons.Default.LocationOn, label = "住所", value = it)
            }

            if (fullName == null && cardInfo.jobTitle == null && companyFull == null &&
                cardInfo.officeName == null && cardInfo.phoneNumber == null &&
                cardInfo.faxNumber == null && cardInfo.email == null &&
                cardInfo.postalCode == null && cardInfo.address == null
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
 * OCR 結果の TextBlock を空間クラスタリングして名刺ごとのブロック群に分割する。
 *
 * 手順:
 * 1. Y座標でソートし、連続するブロック間の縦ギャップがしきい値を超えたら別カードとして分割
 * 2. 各縦クラスタ内でさらに X 方向のギャップが大きければ左右に分割
 *
 * しきい値はブロック高さ中央値の 3 倍（最低 80px）とする。
 */
private fun clusterBlocks(blocks: List<Text.TextBlock>): List<List<Text.TextBlock>> {
    if (blocks.size <= 1) return if (blocks.isEmpty()) emptyList() else listOf(blocks)

    // ── 1. 縦方向クラスタリング ────────────────────────────────────────────
    val sortedByY = blocks.sortedBy { it.boundingBox?.top ?: 0 }
    val heights = sortedByY.mapNotNull { it.boundingBox?.height() }
    val medianHeight = if (heights.isNotEmpty()) heights.sorted()[heights.size / 2] else 0
    val vGapThreshold = maxOf(medianHeight * 3, 80)

    val vClusters = mutableListOf<MutableList<Text.TextBlock>>()
    var current = mutableListOf(sortedByY[0])
    for (i in 1 until sortedByY.size) {
        val prevBottom = sortedByY[i - 1].boundingBox?.bottom ?: 0
        val currTop = sortedByY[i].boundingBox?.top ?: 0
        if (currTop - prevBottom > vGapThreshold) {
            vClusters.add(current)
            current = mutableListOf()
        }
        current.add(sortedByY[i])
    }
    vClusters.add(current)

    // ── 2. 横方向クラスタリング（縦クラスタ内をさらに分割） ─────────────────
    val result = mutableListOf<List<Text.TextBlock>>()
    for (vCluster in vClusters) {
        val sortedByX = vCluster.sortedBy { it.boundingBox?.left ?: 0 }
        val widths = sortedByX.mapNotNull { it.boundingBox?.width() }
        val medianWidth = if (widths.isNotEmpty()) widths.sorted()[widths.size / 2] else 0
        val hGapThreshold = maxOf(medianWidth * 3, 80)

        var hCluster = mutableListOf(sortedByX[0])
        for (i in 1 until sortedByX.size) {
            val prevRight = sortedByX[i - 1].boundingBox?.right ?: 0
            val currLeft = sortedByX[i].boundingBox?.left ?: 0
            if (currLeft - prevRight > hGapThreshold) {
                result.add(hCluster)
                hCluster = mutableListOf()
            }
            hCluster.add(sortedByX[i])
        }
        result.add(hCluster)
    }

    return result.filter { it.isNotEmpty() }
}

/**
 * 指定 URI の画像に対して ML Kit Japanese OCR を実行し、
 * クラスタリングで名刺ごとに分割したうえで [BusinessCardParser] で解析した結果を
 * リストとしてコールバックで返す。
 * コールバックは ML Kit のスレッドから呼ばれるが、UI 更新は Compose の
 * [SnapshotStateList] 経由でスレッドセーフに反映される。
 */
private fun runOcr(
    context: Context,
    imageUri: Uri,
    legalEntityNames: List<String>,
    onResult: (List<BusinessCardInfo>) -> Unit,
) {
    try {
        val recognizer = TextRecognition.getClient(
            JapaneseTextRecognizerOptions.Builder().build(),
        )
        val inputImage = InputImage.fromFilePath(context, imageUri)
        recognizer.process(inputImage)
            .addOnSuccessListener { text ->
                val clusters = clusterBlocks(text.textBlocks)
                val cardInfoList = clusters.map { blocks ->
                    BusinessCardParser.parseBlocks(blocks, legalEntityNames)
                }
                onResult(cardInfoList)
            }
            .addOnFailureListener {
                onResult(emptyList())
            }
    } catch (e: Exception) {
        onResult(emptyList())
    }
}
