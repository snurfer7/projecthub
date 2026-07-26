package com.projecthub.android.ui.utils

import com.projecthub.android.data.api.models.ProjectDto
import java.text.Collator
import java.util.Locale

data class ProjectTreeDisplayRow(
    val project: ProjectDto,
    val depth: Int,
    val hasChildren: Boolean
)

/**
 * Builds a depth-first, pre-order tree of [projects] using [ProjectDto.parentId].
 * Projects whose parent is missing from [projects] (e.g. filtered out by search)
 * are shown as roots, so no project is ever dropped from the result.
 */
fun buildProjectTreeDisplayRows(
    projects: List<ProjectDto>,
    collapsedIds: Set<Int>
): List<ProjectTreeDisplayRow> {
    val byId = projects.associateBy { it.id }
    val collator = Collator.getInstance(Locale.JAPANESE)

    val childrenMap = HashMap<Int, MutableList<ProjectDto>>()
    val roots = mutableListOf<ProjectDto>()
    for (project in projects) {
        val parentId = project.parentId
        if (parentId != null && byId.containsKey(parentId)) {
            childrenMap.getOrPut(parentId) { mutableListOf() }.add(project)
        } else {
            roots.add(project)
        }
    }
    childrenMap.values.forEach { children -> children.sortWith(compareBy(collator) { it.name } ) }
    roots.sortWith(compareBy(collator) { it.name })

    val visited = HashSet<Int>()
    val rows = mutableListOf<ProjectTreeDisplayRow>()

    fun markDescendantsVisited(id: Int) {
        for (child in childrenMap[id].orEmpty()) {
            if (visited.add(child.id)) {
                markDescendantsVisited(child.id)
            }
        }
    }

    fun visit(project: ProjectDto, depth: Int) {
        if (!visited.add(project.id)) return
        val children = childrenMap[project.id].orEmpty()
        rows.add(ProjectTreeDisplayRow(project, depth, children.isNotEmpty()))
        if (project.id in collapsedIds) {
            markDescendantsVisited(project.id)
            return
        }
        for (child in children) {
            visit(child, depth + 1)
        }
    }

    for (root in roots) {
        visit(root, 0)
    }
    // Fallback: any project not reached above (e.g. cyclic parentId chains) is shown as a root.
    for (project in projects) {
        if (project.id !in visited) {
            visit(project, 0)
        }
    }
    return rows
}
