package com.projecthub.android.ui.utils

import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.IssueMetaOptions

data class IssueFilterCriteria(
    val trackerIds: Set<Int> = emptySet(),
    val statusIds: Set<Int> = emptySet(),
    val priorityIds: Set<Int> = emptySet(),
    val assignedToIds: Set<Int> = emptySet(),
    val assignedToGroupIds: Set<Int> = emptySet(),
    val dueDateStart: String = "",
    val dueDateEnd: String = ""
) {
    val isEmpty: Boolean
        get() = trackerIds.isEmpty() && statusIds.isEmpty() && priorityIds.isEmpty() &&
            assignedToIds.isEmpty() && assignedToGroupIds.isEmpty() &&
            dueDateStart.isBlank() && dueDateEnd.isBlank()

    val activeCount: Int
        get() = listOf(
            trackerIds.isNotEmpty(),
            statusIds.isNotEmpty(),
            priorityIds.isNotEmpty(),
            assignedToIds.isNotEmpty(),
            assignedToGroupIds.isNotEmpty(),
            dueDateStart.isNotBlank() || dueDateEnd.isNotBlank()
        ).count { it }
}

/**
 * An assignee/group filter matches if the issue's assignee is directly selected, its assigned
 * group is directly selected, or its assignee is a member of a selected group (metaOptions'
 * `groups[].members` supplies the membership), matching web's assignee-OR-group semantics.
 */
fun matchesIssueFilter(issue: IssueDto, criteria: IssueFilterCriteria, metaOptions: IssueMetaOptions? = null): Boolean {
    if (criteria.trackerIds.isNotEmpty() && issue.trackerId !in criteria.trackerIds) return false
    if (criteria.statusIds.isNotEmpty() && issue.statusId !in criteria.statusIds) return false
    if (criteria.priorityIds.isNotEmpty() && issue.priorityId !in criteria.priorityIds) return false

    if (criteria.assignedToIds.isNotEmpty() || criteria.assignedToGroupIds.isNotEmpty()) {
        val matchesUser = issue.assignedToId != null && issue.assignedToId in criteria.assignedToIds
        val matchesGroup = issue.assignedToGroupId != null && issue.assignedToGroupId in criteria.assignedToGroupIds
        val matchesGroupMember = criteria.assignedToGroupIds.isNotEmpty() && issue.assignedToId != null &&
            metaOptions?.groups.orEmpty()
                .filter { it.id in criteria.assignedToGroupIds }
                .any { group -> group.members.orEmpty().any { it.userId == issue.assignedToId } }
        if (!matchesUser && !matchesGroup && !matchesGroupMember) return false
    }

    if (criteria.dueDateStart.isNotBlank() || criteria.dueDateEnd.isNotBlank()) {
        val dueDate = issue.dueDate?.take(10) ?: return false
        if (criteria.dueDateStart.isNotBlank() && dueDate < criteria.dueDateStart) return false
        if (criteria.dueDateEnd.isNotBlank() && dueDate > criteria.dueDateEnd) return false
    }

    return true
}

fun filterIssues(issues: List<IssueDto>, criteria: IssueFilterCriteria, metaOptions: IssueMetaOptions? = null): List<IssueDto> {
    if (criteria.isEmpty) return issues
    return issues.filter { matchesIssueFilter(it, criteria, metaOptions) }
}
