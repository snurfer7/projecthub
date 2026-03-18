package com.projecthub.android.ui.companies

import android.Manifest
import android.content.pm.PackageManager
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CropFree
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import java.util.concurrent.Executors

// ─── ガイド状態 ───────────────────────────────────────────────────────────────

enum class ScanGuideState {
    /** 名刺がフレーム内に無い、またはまだ解析中 */
    CHECKING,
    /** 輝度不足 */
    TOO_DARK,
    /** 名刺が遠すぎる */
    TOO_FAR,
    /** スキャン可能な状態 */
    READY,
}

// ─── ガイド画面 ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessCardGuideScreen(
    onStartScan: () -> Unit,
    onNavigateBack: () -> Unit,
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }
    var guideState by remember { mutableStateOf(ScanGuideState.CHECKING) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (hasCameraPermission) {
                CameraGuidePreview(
                    modifier = Modifier.fillMaxSize(),
                    onGuideStateChanged = { guideState = it },
                )
                // ── ガイドオーバーレイ ──────────────────────────────────────
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.65f))
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    ScanGuideMessage(state = guideState)
                    Button(
                        onClick = onStartScan,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.DocumentScanner, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("スキャン開始")
                    }
                }
            } else {
                // ── カメラ権限未許可 ────────────────────────────────────────
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Icon(
                        Icons.Default.CameraAlt,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = "カメラの使用を許可してください",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Button(
                        onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    ) {
                        Text("許可する")
                    }
                }
            }
        }
    }
}

// ─── CameraX プレビュー + フレーム解析 ──────────────────────────────────────

@Composable
private fun CameraGuidePreview(
    modifier: Modifier = Modifier,
    onGuideStateChanged: (ScanGuideState) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val textRecognizer = remember {
        TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
    }
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }

    DisposableEffect(lifecycleOwner) {
        onDispose {
            cameraExecutor.shutdown()
            textRecognizer.close()
            try {
                if (cameraProviderFuture.isDone) {
                    cameraProviderFuture.get().unbindAll()
                }
            } catch (_: Exception) {}
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            cameraProviderFuture.addListener(
                {
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    val imageAnalysis = ImageAnalysis.Builder()
                        .setTargetResolution(Size(640, 480))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(
                                cameraExecutor,
                                ScanGuideAnalyzer(textRecognizer, onGuideStateChanged),
                            )
                        }
                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            imageAnalysis,
                        )
                    } catch (_: Exception) {}
                },
                ContextCompat.getMainExecutor(ctx),
            )
            previewView
        },
    )
}

// ─── ガイドメッセージ UI ─────────────────────────────────────────────────────

@Composable
private fun ScanGuideMessage(state: ScanGuideState) {
    data class GuideInfo(val icon: ImageVector, val message: String, val color: Color)

    val info = when (state) {
        ScanGuideState.CHECKING -> GuideInfo(
            icon = Icons.Default.CropFree,
            message = "名刺をフレーム内に合わせてください",
            color = Color.White,
        )
        ScanGuideState.TOO_DARK -> GuideInfo(
            icon = Icons.Default.WbSunny,
            message = "明るい場所で撮影してください",
            color = Color(0xFFFF6B6B),
        )
        ScanGuideState.TOO_FAR -> GuideInfo(
            icon = Icons.Default.ZoomIn,
            message = "もう少し近づけてください",
            color = Color(0xFFFFB347),
        )
        ScanGuideState.READY -> GuideInfo(
            icon = Icons.Default.CheckCircle,
            message = "この状態でスキャンできます",
            color = Color(0xFF69DB7C),
        )
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = info.icon,
            contentDescription = null,
            tint = info.color,
            modifier = Modifier.size(20.dp),
        )
        Text(
            text = info.message,
            style = MaterialTheme.typography.bodyMedium,
            color = info.color,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ─── フレーム解析 Analyzer ────────────────────────────────────────────────────

private class ScanGuideAnalyzer(
    private val textRecognizer: TextRecognizer,
    private val onStateChanged: (ScanGuideState) -> Unit,
) : ImageAnalysis.Analyzer {

    private var lastTextAnalysisMs = 0L

    @ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        // 1. 輝度チェック（毎フレーム・高速）
        val brightness = computeBrightness(imageProxy)
        if (brightness < 70f) {
            onStateChanged(ScanGuideState.TOO_DARK)
            imageProxy.close()
            return
        }

        // 2. 距離チェック（ML Kit テキスト検出・800ms スロットリング）
        val now = System.currentTimeMillis()
        if (now - lastTextAnalysisMs < 800L) {
            imageProxy.close()
            return
        }
        lastTextAnalysisMs = now

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            onStateChanged(ScanGuideState.CHECKING)
            return
        }

        val inputImage = InputImage.fromMediaImage(
            mediaImage, imageProxy.imageInfo.rotationDegrees,
        )
        val imageHeight = imageProxy.height.toFloat()

        textRecognizer.process(inputImage)
            .addOnSuccessListener { visionText ->
                val blocks = visionText.textBlocks
                when {
                    blocks.isEmpty() ->
                        onStateChanged(ScanGuideState.CHECKING)
                    blocks.all { (it.boundingBox?.height() ?: 0) < imageHeight * 0.03f } ->
                        onStateChanged(ScanGuideState.TOO_FAR)
                    else ->
                        onStateChanged(ScanGuideState.READY)
                }
            }
            .addOnFailureListener {
                onStateChanged(ScanGuideState.CHECKING)
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    /**
     * YUV_420_888 の Y プレーン（輝度）平均を 0〜255 で返す。
     * 8 ピクセルおきにサンプリングして高速化。
     */
    private fun computeBrightness(imageProxy: ImageProxy): Float {
        val plane = imageProxy.planes[0]
        val buffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        val width = imageProxy.width
        val height = imageProxy.height
        var total = 0L
        var count = 0
        for (row in 0 until height step 8) {
            for (col in 0 until width step 8) {
                val idx = row * rowStride + col * pixelStride
                if (idx < buffer.limit()) {
                    total += (buffer.get(idx).toInt() and 0xFF)
                    count++
                }
            }
        }
        return if (count > 0) total.toFloat() / count else 128f
    }
}
