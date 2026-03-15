package com.projecthub.android.data.api.models

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
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?,
    @SerializedName("doneRatio") val doneRatio: Int,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?,
    val position: Int,
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
    val name: String
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
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?
)

data class UpdateIssueRequest(
    @SerializedName("trackerId") val trackerId: Int?,
    @SerializedName("statusId") val statusId: Int?,
    @SerializedName("priorityId") val priorityId: Int?,
    @SerializedName("assignedToId") val assignedToId: Int?,
    @SerializedName("assignedToGroupId") val assignedToGroupId: Int?,
    val subject: String?,
    val description: String?,
    @SerializedName("startDate") val startDate: String?,
    @SerializedName("dueDate") val dueDate: String?,
    @SerializedName("estimatedHours") val estimatedHours: Int?,
    @SerializedName("doneRatio") val doneRatio: Int?
)

data class AddCommentRequest(
    val content: String
)
