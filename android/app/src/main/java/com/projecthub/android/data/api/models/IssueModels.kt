package com.projecthub.android.data.api.models

import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonPrimitive
import com.google.gson.annotations.SerializedName

data class IssueDto(
    val id: Int,
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("trackerId") val trackerId: Int,
    @SerializedName("statusId") val statusId: Int,
    @SerializedName("priorityId") val priorityId: Int,
    @SerializedName("authorId") val authorId: Int,
    @SerializedName("assignedToId") val assignedToId: Int?,
    @SerializedName("assignedToGroupId") val assignedToGroupId: Int?,
    val subject: String,
    val description: String?,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("endDate") val endDate: String? = null,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?,
    @SerializedName("doneRatio") val doneRatio: Int,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?,
    val position: Int,
    @SerializedName("parentId") val parentId: Int? = null,
    val parent: IssueRefDto? = null,
    val children: List<IssueChildDto>? = null,
    @SerializedName("_count") val count: IssueCountDto? = null,
    val project: ProjectRefDto?,
    val tracker: TrackerDto?,
    val status: IssueStatusDto?,
    val priority: IssuePriorityDto?,
    val author: UserRefDto?,
    val assignedTo: UserRefDto?,
    val assignedToGroup: GroupRefDto?,
    val comments: List<IssueCommentDto>?,
    @SerializedName("timeEntries") val timeEntries: List<TimeEntryDto>?
)

data class IssueChildDto(
    val id: Int,
    val subject: String,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("endDate") val endDate: String?,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("parentId") val parentId: Int?,
    @SerializedName("statusId") val statusId: Int?
)

data class IssueCountDto(
    val children: Int = 0,
    val comments: Int = 0
)

data class TrackerDto(
    val id: Int,
    val name: String,
    val position: Int
)

data class IssueStatusDto(
    val id: Int,
    val name: String,
    @SerializedName("isClosed") val isClosed: Boolean,
    val position: Int
)

data class IssuePriorityDto(
    val id: Int,
    val name: String,
    val position: Int
)

data class GroupRefDto(
    val id: Int,
    val name: String,
    val members: List<GroupMemberUserRefDto>? = null
)

data class GroupMemberUserRefDto(
    @SerializedName("userId") val userId: Int
)

data class IssueCommentDto(
    val id: Int,
    @SerializedName("issueId") val issueId: Int,
    @SerializedName("userId") val userId: Int,
    val content: String,
    @SerializedName("createdAt") val createdAt: String?,
    val user: UserRefDto?
)

data class IssueMetaOptions(
    val trackers: List<TrackerDto>,
    val statuses: List<IssueStatusDto>,
    val priorities: List<IssuePriorityDto>,
    val users: List<UserRefDto>,
    val groups: List<GroupRefDto>?
)

data class CreateIssueRequest(
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("trackerId") val trackerId: Int,
    @SerializedName("statusId") val statusId: Int,
    @SerializedName("priorityId") val priorityId: Int,
    @SerializedName("assignedToId") val assignedToId: Int?,
    @SerializedName("assignedToGroupId") val assignedToGroupId: Int?,
    val subject: String,
    val description: String?,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("endDate") val endDate: String? = null,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?,
    @SerializedName("parentId") val parentId: Int? = null
)

/**
 * [parentId] uses [JsonElement] instead of [Int]? because Gson (configured without
 * serializeNulls()) omits Kotlin-null fields entirely, meaning a plain null can only express
 * "leave unchanged", not "clear the parent". Use [parentIdBody] to build a value that
 * distinguishes "unchanged" (don't set this property) from "cleared" (JsonNull) from "set" (JsonPrimitive).
 */
data class UpdateIssueRequest(
    @SerializedName("trackerId") val trackerId: Int?,
    @SerializedName("statusId") val statusId: Int?,
    @SerializedName("priorityId") val priorityId: Int?,
    @SerializedName("assignedToId") val assignedToId: Int?,
    @SerializedName("assignedToGroupId") val assignedToGroupId: Int?,
    val subject: String?,
    val description: String?,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("endDate") val endDate: String? = null,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?,
    @SerializedName("doneRatio") val doneRatio: Int?,
    @SerializedName("parentId") val parentId: JsonElement? = null
)

/** null = clear the parent (sent as JSON null); non-null = set the given parent id. */
fun parentIdBody(value: Int?): JsonElement =
    if (value == null) JsonNull.INSTANCE else JsonPrimitive(value)

data class AddCommentRequest(
    val content: String
)
