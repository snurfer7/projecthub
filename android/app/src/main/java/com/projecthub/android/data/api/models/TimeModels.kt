package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class TimeEntryDto(
    val id: Int,
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("issueId") val issueId: Int?,
    @SerializedName("userId") val userId: Int,
    val hours: Double,
    val activity: String,
    @SerializedName("spentOn") val spentOn: String,
    val comments: String?,
    @SerializedName("createdAt") val createdAt: String?,
    val project: ProjectRefDto?,
    val issue: IssueRefDto?,
    val user: UserRefDto?
)

data class IssueRefDto(
    val id: Int,
    val subject: String
)

data class CreateTimeEntryRequest(
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("issueId") val issueId: Int?,
    val hours: Double,
    val activity: String,
    @SerializedName("spentOn") val spentOn: String,
    val comments: String?
)
