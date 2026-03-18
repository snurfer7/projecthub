package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class CompanyDto(
    val id: Int,
    val name: String,
    @SerializedName("legalEntityStatusId") val legalEntityStatusId: Int?,
    val phone: String?,
    val fax: String?,
    val website: String?,
    val notes: String?,
    @SerializedName("createdAt") val createdAt: String?,
    val building: String?,
    val city: String?,
    @SerializedName("postalCode") val postalCode: String?,
    val prefecture: String?,
    val street: String?,
    @SerializedName("legalEntityPosition") val legalEntityPosition: String?,
    @SerializedName("legalEntityStatus") val legalEntityStatus: LegalEntityStatusDto?,
    val locations: List<LocationDto>?,
    val contacts: List<ContactDto>?
)

data class LegalEntityStatusDto(
    val id: Int,
    val name: String,
    val position: Int
)

data class LocationDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val name: String,
    val phone: String?,
    @SerializedName("postalCode") val postalCode: String?,
    val prefecture: String?,
    val city: String?,
    val street: String?,
    val building: String?,
    val notes: String?,
    @SerializedName("createdAt") val createdAt: String?
)

data class ContactDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    val email: String?,
    val phone: String?,
    val position: String?,
    val department: String?,
    val notes: String?,
    @SerializedName("createdAt") val createdAt: String?
) {
    val fullName: String get() = "$firstName $lastName"
}

data class DealDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val name: String,
    val amount: Double?,
    val status: String,
    val probability: Int?,
    @SerializedName("expectedCloseDate") val expectedCloseDate: String?,
    @SerializedName("contactId") val contactId: Int?,
    @SerializedName("assignedToId") val assignedToId: Int?,
    val notes: String?,
    @SerializedName("createdAt") val createdAt: String?
)

data class ActivityDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val type: String,
    val subject: String,
    val description: String?,
    @SerializedName("contactId") val contactId: Int?,
    @SerializedName("dealId") val dealId: Int?,
    @SerializedName("dueDate") val dueDate: String?,
    val completed: Boolean,
    @SerializedName("createdAt") val createdAt: String?
)

// --- Create/Update Request models ---

data class CreateCompanyRequest(
    val name: String,
    @SerializedName("legalEntityStatusId") val legalEntityStatusId: Int? = null,
    @SerializedName("legalEntityPosition") val legalEntityPosition: String? = null,
    @SerializedName("postalCode") val postalCode: String? = null,
    val prefecture: String? = null,
    val city: String? = null,
    val street: String? = null,
    val building: String? = null,
    val phone: String? = null,
    val fax: String? = null,
    val website: String? = null,
    val notes: String? = null
)

/** 会社更新。Backend PUT /api/companies/:id の Body と同じ。 */
data class UpdateCompanyRequest(
    val name: String,
    @SerializedName("legalEntityStatusId") val legalEntityStatusId: Int? = null,
    @SerializedName("legalEntityPosition") val legalEntityPosition: String? = null,
    @SerializedName("postalCode") val postalCode: String? = null,
    val prefecture: String? = null,
    val city: String? = null,
    val street: String? = null,
    val building: String? = null,
    val phone: String? = null,
    val fax: String? = null,
    val website: String? = null,
    val notes: String? = null
)

data class CreateContactRequest(
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    @SerializedName("companyId") val companyId: Int,
    val notes: String? = null,
    val details: List<ContactDetailRequest> = emptyList()
)

data class ContactDetailRequest(
    val department: String? = null,
    val position: String? = null,
    val phone: String? = null,
    val email: String? = null,
    @SerializedName("locationId") val locationId: Int? = null,
    @SerializedName("isPrimary") val isPrimary: Boolean = false
)

data class CreateDealRequest(
    val name: String,
    @SerializedName("companyId") val companyId: Int,
    val amount: Double? = null,
    val status: String = "prospecting",
    val probability: Int? = null,
    @SerializedName("expectedCloseDate") val expectedCloseDate: String? = null,
    @SerializedName("contactId") val contactId: Int? = null,
    val notes: String? = null
)

data class CreateActivityRequest(
    @SerializedName("companyId") val companyId: Int,
    val type: String,
    val subject: String,
    val description: String? = null,
    @SerializedName("contactId") val contactId: Int? = null,
    @SerializedName("dealId") val dealId: Int? = null,
    @SerializedName("dueDate") val dueDate: String? = null,
    val completed: Boolean = false
)

data class CreateLocationRequest(
    val name: String,
    val phone: String? = null,
    @SerializedName("postalCode") val postalCode: String? = null,
    val prefecture: String? = null,
    val city: String? = null,
    val street: String? = null,
    val building: String? = null,
    val notes: String? = null
)

data class CompanyWikiPageDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val title: String,
    val content: String,
    @SerializedName("authorId") val authorId: Int?,
    val author: UserRefDto?,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?,
    @SerializedName("parentId") val parentId: Int?,
    val position: Int,
    val children: List<CompanyWikiPageDto>?
)

data class CompanyCommentDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val content: String,
    val author: UserRefDto?,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)
