package com.projecthub.android.ui.companies

import com.google.mlkit.vision.text.Text

/**
 * ML Kit Text Recognition の結果（[Text]）から名刺情報を抽出するユーティリティ。
 *
 * ### 抽出ロジック概要
 * - **メール / 電話番号**: 正規表現でマッチ。OCR 誤認識（ハイフンが長音「ー」になる等）を許容する柔軟なパターン。
 * - **法人格 / 会社名**: 引数で渡された法人格リスト（システム登録値）を長い順にマッチし、前後の文字列を会社名として分離。
 * - **氏名**: BoundingBox の高さが最大の [Text.TextBlock] を姓名候補とし、スペースや文字数で姓/名を分割。
 * - **役職**: キーワードリストに含まれる行をそのまま役職として採用。氏名ブロックとの近接も考慮。
 * - **拠点名**: 支店・営業所などのキーワードを含む行を採用。
 */
object BusinessCardParser {

    // ─── デフォルト法人格リスト（APIから取得できない場合のフォールバック） ───────────
    private val DEFAULT_LEGAL_ENTITIES = listOf(
        "一般社団法人", "公益社団法人", "一般財団法人", "公益財団法人",
        "特定非営利活動法人", "医療法人社団", "医療法人財団", "医療法人",
        "学校法人", "宗教法人", "社会福祉法人", "農業協同組合",
        "株式会社", "合同会社", "有限会社", "合資会社", "合名会社",
        "社団法人", "財団法人", "協同組合", "信用金庫",
    )

    // ─── 正規表現 ────────────────────────────────────────────────────────────────
    /** メールアドレス */
    private val EMAIL_REGEX = Regex(
        "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    )

    /**
     * 日本の電話番号。OCR 誤認識でハイフンが「ー」「―」「−」になることを許容。
     * 市外局番 (0X〜0XXXX) + 市内番号 + 加入者番号 の形式に対応。
     */
    private val PHONE_REGEX = Regex(
        "0[0-9０-９]{1,4}[ー\u2013\u2014\\-－ \u3000]{0,2}[0-9０-９]{1,4}[ー\u2013\u2014\\-－ \u3000]{0,2}[0-9０-９]{4}",
    )

    /** 郵便番号（住所ブロック判定に使用） */
    private val POSTAL_REGEX = Regex("[〒]?[0-9０-９]{3}[ー\\-－][0-9０-９]{4}")

    /** 住所都道府県キーワード */
    private val ADDRESS_KEYWORDS = listOf("都", "道", "府", "県", "市", "区", "町", "村", "丁目", "番地", "号")

    // ─── 役職キーワード ──────────────────────────────────────────────────────────
    private val JOB_TITLE_KEYWORDS = listOf(
        "代表取締役会長", "代表取締役社長", "代表取締役", "取締役会長", "取締役社長", "取締役",
        "会長", "社長", "副社長", "専務取締役", "常務取締役", "専務", "常務",
        "執行役員", "上席執行役員", "本部長", "副本部長",
        "部長", "副部長", "次長", "課長", "係長", "主任", "主席",
        "ゼネラルマネージャー", "マネージャー", "シニアマネージャー",
        "エグゼクティブディレクター", "ディレクター", "チーフディレクター",
        "リーダー", "チーフ", "シニア", "プリンシパル",
        "エンジニア", "デザイナー", "コンサルタント",
        "アドバイザー", "スペシャリスト", "アナリスト",
        "担当", "スタッフ", "アシスタント", "インターン",
    )

    // ─── 拠点キーワード ──────────────────────────────────────────────────────────
    private val OFFICE_KEYWORDS = listOf(
        "支店", "営業所", "支社", "出張所", "事務所", "センター",
        "本社", "本店", "オフィス", "ラボ", "研究所",
    )

    // ────────────────────────────────────────────────────────────────────────────

    /**
     * ML Kit の [Text] オブジェクトを解析し、[BusinessCardInfo] を返す。
     *
     * @param text ML Kit が返す OCR 結果
     * @param legalEntityNames システムに登録されている法人格名リスト（空の場合はデフォルト値を使用）
     */
    fun parse(text: Text, legalEntityNames: List<String> = emptyList()): BusinessCardInfo {
        val entityList = legalEntityNames.ifEmpty { DEFAULT_LEGAL_ENTITIES }
            .sortedByDescending { it.length } // 長い法人格を優先マッチ

        val allLines = text.textBlocks.flatMap { it.lines }
        val lineTexts = allLines.map { it.text.trim() }.filter { it.isNotBlank() }

        // ── 各フィールドを抽出 ───────────────────────────────────────────────
        val email = extractEmail(lineTexts)
        val phone = extractPhone(lineTexts)
        val (companyName, legalEntityName, legalEntityPosition) = extractCompany(lineTexts, entityList)
        val (lastName, firstName) = extractName(text, entityList)
        val jobTitle = extractJobTitle(lineTexts, text, lastName, firstName)
        val officeName = extractOfficeName(lineTexts)

        return BusinessCardInfo(
            companyName = companyName,
            legalEntityName = legalEntityName,
            legalEntityPosition = legalEntityPosition,
            phoneNumber = phone,
            email = email,
            firstName = firstName,
            lastName = lastName,
            officeName = officeName,
            jobTitle = jobTitle,
        )
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────

    private fun extractEmail(lines: List<String>): String? =
        lines.firstNotNullOfOrNull { EMAIL_REGEX.find(it)?.value }

    private fun extractPhone(lines: List<String>): String? {
        for (line in lines) {
            // 全角数字を半角に正規化してからマッチ
            val normalized = normalizeDigits(line)
            val match = PHONE_REGEX.find(normalized) ?: continue
            // ハイフン代用文字を半角ハイフンに統一して返す
            return match.value.replace(Regex("[ー\u2013\u2014－]"), "-").replace("　", "-")
        }
        return null
    }

    /**
     * 法人格と会社名を分離する。
     * @return Triple(会社名, 法人格名, 法人格位置 "前"/"後")
     */
    private fun extractCompany(
        lines: List<String>,
        entityList: List<String>,
    ): Triple<String?, String?, String?> {
        for (line in lines) {
            for (entity in entityList) {
                if (!line.contains(entity)) continue
                return when {
                    line.startsWith(entity) -> {
                        val name = line.removePrefix(entity).trim()
                        Triple(name.ifBlank { null }, entity, "前")
                    }
                    line.endsWith(entity) -> {
                        val name = line.removeSuffix(entity).trim()
                        Triple(name.ifBlank { null }, entity, "後")
                    }
                    else -> {
                        // 法人格が途中にある場合は前側を会社名とする
                        val idx = line.indexOf(entity)
                        val name = line.substring(0, idx).trim()
                        Triple(name.ifBlank { null }, entity, "後")
                    }
                }
            }
        }
        return Triple(null, null, null)
    }

    /**
     * 姓名を抽出する。
     * BoundingBox の高さ（≒フォントサイズ）が最大の TextBlock を名前候補とし、
     * スペース区切りまたは文字数で姓/名を分割する。
     *
     * @return Pair(姓, 名)
     */
    private fun extractName(text: Text, entityList: List<String>): Pair<String?, String?> {
        val nameBlock = text.textBlocks
            .filter { block ->
                val t = block.text.trim()
                // 除外条件: メール・電話・URL・法人格・住所・空白多め・短すぎ/長すぎ
                t.length in 2..12 &&
                    !EMAIL_REGEX.containsMatchIn(t) &&
                    !PHONE_REGEX.containsMatchIn(normalizeDigits(t)) &&
                    !t.contains("@") &&
                    !t.contains("http") &&
                    !t.contains("www") &&
                    entityList.none { t.contains(it) } &&
                    ADDRESS_KEYWORDS.none { kw -> t.endsWith(kw) } &&
                    !POSTAL_REGEX.containsMatchIn(t)
            }
            .maxByOrNull { block ->
                // 各行の BoundingBox 高さの平均をフォントサイズの代理指標とする
                block.lines.mapNotNull { it.boundingBox?.height()?.toDouble() }.average()
                    .takeIf { !it.isNaN() } ?: 0.0
            }
            ?: return Pair(null, null)

        val fullName = nameBlock.text.trim()

        // スペース（半角・全角）で分割
        val parts = fullName.split(Regex("[ 　]+")).filter { it.isNotBlank() }
        return when {
            parts.size >= 2 -> Pair(parts[0], parts[1])       // "山田 太郎" → 姓=山田, 名=太郎
            fullName.length == 4 -> Pair(fullName.take(2), fullName.drop(2)) // "山田太郎"
            fullName.length == 3 -> Pair(fullName.take(2), fullName.drop(2)) // "山田稔" → 2+1
            fullName.length >= 5 -> Pair(fullName.take(3), fullName.drop(3)) // 3文字姓を想定
            else -> Pair(fullName, null)
        }
    }

    /**
     * 役職を抽出する。
     * キーワードマッチを優先し、見つからない場合は姓名ブロックの直上の行を候補とする。
     */
    private fun extractJobTitle(
        lines: List<String>,
        text: Text,
        lastName: String?,
        firstName: String?,
    ): String? {
        // 1. キーワードマッチ
        for (line in lines) {
            for (keyword in JOB_TITLE_KEYWORDS) {
                if (line.contains(keyword)) return line.trim()
            }
        }

        // 2. 姓名の直上ブロックを候補とする（座標ベース）
        if (lastName != null) {
            val fullName = if (firstName != null) "$lastName $firstName" else lastName
            val nameBlock = text.textBlocks.firstOrNull { it.text.contains(lastName) }
            val nameTop = nameBlock?.boundingBox?.top ?: return null

            // 姓名ブロックの上方向で最も近いブロック
            val candidate = text.textBlocks
                .filter { block ->
                    val bottom = block.boundingBox?.bottom ?: Int.MAX_VALUE
                    bottom < nameTop && !block.text.contains(fullName)
                }
                .minByOrNull { block -> nameTop - (block.boundingBox?.bottom ?: 0) }
                ?.text?.trim()

            if (candidate != null && candidate.length in 2..20) return candidate
        }

        return null
    }

    /**
     * 拠点名を抽出する。
     * 支店・営業所などのキーワードを含む行、または住所の直前行を採用。
     */
    private fun extractOfficeName(lines: List<String>): String? {
        for (line in lines) {
            for (keyword in OFFICE_KEYWORDS) {
                if (line.contains(keyword)) return line.trim()
            }
        }
        // 住所行（都道府県含む）の直前行が拠点名の可能性
        for (i in lines.indices) {
            if (ADDRESS_KEYWORDS.any { lines[i].contains(it) } && i > 0) {
                val prev = lines[i - 1]
                // 電話・メール・法人格・郵便番号でないこと
                if (!EMAIL_REGEX.containsMatchIn(prev) &&
                    !PHONE_REGEX.containsMatchIn(normalizeDigits(prev)) &&
                    !POSTAL_REGEX.containsMatchIn(prev) &&
                    prev.length in 2..20
                ) {
                    return prev.trim()
                }
            }
        }
        return null
    }

    /** 全角数字を半角数字に正規化する */
    private fun normalizeDigits(s: String): String = buildString {
        for (c in s) {
            append(if (c in '０'..'９') '0' + (c - '０') else c)
        }
    }
}
