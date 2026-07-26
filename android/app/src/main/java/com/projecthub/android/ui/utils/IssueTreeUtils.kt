package com.projecthub.android.ui.utils

import com.projecthub.android.data.api.models.IssueDto

/** True if [issue] has no children, using `_count.children` when available. */
fun isLeafIssue(issue: IssueDto, allIssues: List<IssueDto>? = null): Boolean {
    issue.count?.let { return it.children == 0 }
    if (allIssues == null) return true
    return allIssues.none { it.parentId == issue.id }
}

fun buildIssueByIdMap(issues: List<IssueDto>): Map<Int, IssueDto> = issues.associateBy { it.id }

data class IssueAncestorRef(val id: Int, val subject: String)

/** Root-first ancestor chain, not including [issue] itself. */
fun getAncestorChain(issue: IssueDto, byId: Map<Int, IssueDto>): List<IssueAncestorRef> {
    val chain = mutableListOf<IssueAncestorRef>()
    val visited = HashSet<Int>()
    var currentParentId = issue.parentId
    var currentParentRef = issue.parent
    while (currentParentId != null && visited.add(currentParentId)) {
        val fromMap = byId[currentParentId]
        if (fromMap != null) {
            chain.add(0, IssueAncestorRef(fromMap.id, fromMap.subject))
            currentParentId = fromMap.parentId
            currentParentRef = fromMap.parent
        } else if (currentParentRef != null) {
            chain.add(0, IssueAncestorRef(currentParentRef.id, currentParentRef.subject))
            break
        } else {
            break
        }
    }
    return chain
}

data class IssueTreeDisplayRow(
    val issue: IssueDto,
    val depth: Int,
    val hasChildren: Boolean
)

/** Same tree-building shape as [buildProjectTreeDisplayRows], siblings ordered by position then id. */
fun buildIssueTreeDisplayRows(
    issues: List<IssueDto>,
    collapsedIds: Set<Int>
): List<IssueTreeDisplayRow> {
    val byId = issues.associateBy { it.id }
    val childrenMap = HashMap<Int, MutableList<IssueDto>>()
    val roots = mutableListOf<IssueDto>()
    for (issue in issues) {
        val parentId = issue.parentId
        if (parentId != null && byId.containsKey(parentId)) {
            childrenMap.getOrPut(parentId) { mutableListOf() }.add(issue)
        } else {
            roots.add(issue)
        }
    }
    val siblingComparator = compareBy<IssueDto>({ it.position }, { it.id })
    childrenMap.values.forEach { it.sortWith(siblingComparator) }
    roots.sortWith(siblingComparator)

    val visited = HashSet<Int>()
    val rows = mutableListOf<IssueTreeDisplayRow>()

    fun markDescendantsVisited(id: Int) {
        for (child in childrenMap[id].orEmpty()) {
            if (visited.add(child.id)) {
                markDescendantsVisited(child.id)
            }
        }
    }

    fun visit(issue: IssueDto, depth: Int) {
        if (!visited.add(issue.id)) return
        val children = childrenMap[issue.id].orEmpty()
        rows.add(IssueTreeDisplayRow(issue, depth, children.isNotEmpty()))
        if (issue.id in collapsedIds) {
            markDescendantsVisited(issue.id)
            return
        }
        for (child in children) {
            visit(child, depth + 1)
        }
    }

    for (root in roots) {
        visit(root, 0)
    }
    for (issue in issues) {
        if (issue.id !in visited) {
            visit(issue, 0)
        }
    }
    return rows
}

/** [issueId] itself plus every descendant id, for excluding self/descendants from a parent-ticket selector. */
fun collectDescendantIds(issueId: Int, issues: List<IssueDto>): Set<Int> {
    val childrenMap = HashMap<Int, MutableList<Int>>()
    for (issue in issues) {
        val parentId = issue.parentId ?: continue
        childrenMap.getOrPut(parentId) { mutableListOf() }.add(issue.id)
    }
    val result = mutableSetOf(issueId)
    val stack = ArrayDeque<Int>()
    stack.addLast(issueId)
    while (stack.isNotEmpty()) {
        val current = stack.removeLast()
        for (childId in childrenMap[current].orEmpty()) {
            if (result.add(childId)) {
                stack.addLast(childId)
            }
        }
    }
    return result
}
