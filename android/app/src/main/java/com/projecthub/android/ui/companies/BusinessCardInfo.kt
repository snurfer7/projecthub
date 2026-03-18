package com.projecthub.android.ui.companies

/**
 * 名刺から抽出された情報を保持するデータクラス。
 */
data class BusinessCardInfo(
    /** 会社名（法人格を除いた部分） */
    val companyName: String? = null,
    /** 法人格 (例: "株式会社", "有限会社") */
    val legalEntityName: String? = null,
    /** 法人格の位置 — "前" (法人格○○) or "後" (○○法人格) */
    val legalEntityPosition: String? = null,
    /** 電話番号 */
    val phoneNumber: String? = null,
    /** FAX 番号 */
    val faxNumber: String? = null,
    /** メールアドレス */
    val email: String? = null,
    /** 名（First Name） */
    val firstName: String? = null,
    /** 姓（Last Name） */
    val lastName: String? = null,
    /** 拠点名・支店名 */
    val officeName: String? = null,
    /** 役職 */
    val jobTitle: String? = null,
    /** 郵便番号（例: "123-4567"） */
    val postalCode: String? = null,
    /** 住所 */
    val address: String? = null,
)
