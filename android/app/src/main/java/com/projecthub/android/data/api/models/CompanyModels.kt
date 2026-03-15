package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class CompanyDto(
    val id: Int,
    val name: String,
    @SerializedName("legalEntityStatusId") val legalEntityStatusId: Int?,
    val phone: String?,
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
