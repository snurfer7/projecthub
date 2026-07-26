package com.projecthub.android.data.api.models

import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName

const val SAVED_SEARCH_VIEW_MODE_LIST = "list"
const val SAVED_SEARCH_VIEW_MODE_KANBAN = "kanban"

data class SavedSearchDto(
    val id: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("viewMode") val viewMode: String,
    val name: String,
    @SerializedName("isDefault") val isDefault: Boolean,
    val filter: JsonObject? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

data class CreateSavedSearchRequest(
    @SerializedName("viewMode") val viewMode: String,
    val name: String,
    val filter: JsonObject,
    @SerializedName("isDefault") val isDefault: Boolean = false
)

data class UpdateSavedSearchRequest(
    val name: String? = null,
    val filter: JsonObject? = null,
    @SerializedName("isDefault") val isDefault: Boolean? = null
)
