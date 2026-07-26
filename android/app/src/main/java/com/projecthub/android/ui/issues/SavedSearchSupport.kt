package com.projecthub.android.ui.issues

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.projecthub.android.data.api.models.SavedSearchDto
import com.projecthub.android.ui.utils.IssueFilterCriteria

const val SAVED_SEARCH_CLIENT = "android"

private fun intSetToJsonArray(set: Set<Int>): JsonArray {
    val array = JsonArray()
    set.forEach { array.add(it) }
    return array
}

private fun jsonArrayToIntSet(array: JsonArray?): Set<Int> {
    if (array == null) return emptySet()
    return array.mapNotNull { it.asInt }.toSet()
}

/** Android's own opaque shape for the `filter` JSON blob; not shared with web's saved searches. */
fun IssueFilterCriteria.toFilterJson(): JsonObject {
    val obj = JsonObject()
    obj.addProperty("client", SAVED_SEARCH_CLIENT)
    obj.add("trackerIds", intSetToJsonArray(trackerIds))
    obj.add("statusIds", intSetToJsonArray(statusIds))
    obj.add("priorityIds", intSetToJsonArray(priorityIds))
    obj.add("assignedToIds", intSetToJsonArray(assignedToIds))
    obj.add("assignedToGroupIds", intSetToJsonArray(assignedToGroupIds))
    obj.addProperty("dueDateStart", dueDateStart)
    obj.addProperty("dueDateEnd", dueDateEnd)
    return obj
}

fun JsonObject?.toIssueFilterCriteriaOrNull(): IssueFilterCriteria? {
    if (this == null || get("client")?.asString != SAVED_SEARCH_CLIENT) return null
    return IssueFilterCriteria(
        trackerIds = jsonArrayToIntSet(getAsJsonArray("trackerIds")),
        statusIds = jsonArrayToIntSet(getAsJsonArray("statusIds")),
        priorityIds = jsonArrayToIntSet(getAsJsonArray("priorityIds")),
        assignedToIds = jsonArrayToIntSet(getAsJsonArray("assignedToIds")),
        assignedToGroupIds = jsonArrayToIntSet(getAsJsonArray("assignedToGroupIds")),
        dueDateStart = get("dueDateStart")?.asString ?: "",
        dueDateEnd = get("dueDateEnd")?.asString ?: ""
    )
}

/** Web's saved searches share the same list endpoint; only show ones Android itself created. */
fun List<SavedSearchDto>.androidOnly(): List<SavedSearchDto> =
    filter { it.filter?.get("client")?.takeIf { el -> el.isJsonPrimitive }?.asString == SAVED_SEARCH_CLIENT }
