package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class GanttProjectResponse(
    val project: GanttProjectRefDto,
    val issues: List<IssueDto>
)

data class GanttProjectRefDto(
    val id: Int,
    val name: String,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("parentId") val parentId: Int?
)
