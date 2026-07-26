package com.projecthub.android.ui.issues

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.projecthub.android.data.api.models.IssueMetaOptions
import com.projecthub.android.ui.components.DatePickerField
import com.projecthub.android.ui.utils.IssueFilterCriteria

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueFilterBottomSheet(
    metaOptions: IssueMetaOptions?,
    criteria: IssueFilterCriteria,
    savedSearchSlot: (@Composable () -> Unit)? = null,
    onApply: (IssueFilterCriteria) -> Unit,
    onDismiss: () -> Unit
) {
    var trackerIds by remember(criteria) { mutableStateOf(criteria.trackerIds) }
    var statusIds by remember(criteria) { mutableStateOf(criteria.statusIds) }
    var priorityIds by remember(criteria) { mutableStateOf(criteria.priorityIds) }
    var assignedToIds by remember(criteria) { mutableStateOf(criteria.assignedToIds) }
    var assignedToGroupIds by remember(criteria) { mutableStateOf(criteria.assignedToGroupIds) }
    var dueDateStart by remember(criteria) { mutableStateOf(criteria.dueDateStart) }
    var dueDateEnd by remember(criteria) { mutableStateOf(criteria.dueDateEnd) }

    fun <T> toggle(set: Set<T>, value: T): Set<T> = if (value in set) set - value else set + value

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "フィルター",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            savedSearchSlot?.invoke()

            metaOptions?.let { options ->
                MultiSelectFilterSection(
                    label = "トラッカー",
                    items = options.trackers.map { it.id to it.name },
                    selected = trackerIds,
                    onToggle = { trackerIds = toggle(trackerIds, it) }
                )
                Spacer(modifier = Modifier.height(12.dp))
                MultiSelectFilterSection(
                    label = "ステータス",
                    items = options.statuses.map { it.id to it.name },
                    selected = statusIds,
                    onToggle = { statusIds = toggle(statusIds, it) }
                )
                Spacer(modifier = Modifier.height(12.dp))
                MultiSelectFilterSection(
                    label = "優先度",
                    items = options.priorities.map { it.id to it.name },
                    selected = priorityIds,
                    onToggle = { priorityIds = toggle(priorityIds, it) }
                )
                Spacer(modifier = Modifier.height(12.dp))
                MultiSelectFilterSection(
                    label = "担当者",
                    items = options.users.map { it.id to it.fullName },
                    selected = assignedToIds,
                    onToggle = { assignedToIds = toggle(assignedToIds, it) }
                )
                options.groups?.takeIf { it.isNotEmpty() }?.let { groups ->
                    Spacer(modifier = Modifier.height(12.dp))
                    MultiSelectFilterSection(
                        label = "担当グループ",
                        items = groups.map { it.id to it.name },
                        selected = assignedToGroupIds,
                        onToggle = { assignedToGroupIds = toggle(assignedToGroupIds, it) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "チケット期限",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DatePickerField(
                    value = dueDateStart,
                    onValueChange = { dueDateStart = it },
                    label = "開始",
                    modifier = Modifier.weight(1f)
                )
                DatePickerField(
                    value = dueDateEnd,
                    onValueChange = { dueDateEnd = it },
                    label = "終了",
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        trackerIds = emptySet(); statusIds = emptySet(); priorityIds = emptySet()
                        assignedToIds = emptySet(); assignedToGroupIds = emptySet()
                        dueDateStart = ""; dueDateEnd = ""
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("クリア")
                }
                Button(
                    onClick = {
                        onApply(
                            IssueFilterCriteria(
                                trackerIds = trackerIds,
                                statusIds = statusIds,
                                priorityIds = priorityIds,
                                assignedToIds = assignedToIds,
                                assignedToGroupIds = assignedToGroupIds,
                                dueDateStart = dueDateStart,
                                dueDateEnd = dueDateEnd
                            )
                        )
                        onDismiss()
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("適用")
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun MultiSelectFilterSection(
    label: String,
    items: List<Pair<Int, String>>,
    selected: Set<Int>,
    onToggle: (Int) -> Unit
) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Spacer(modifier = Modifier.height(4.dp))
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(items) { (id, name) ->
            FilterChip(
                selected = id in selected,
                onClick = { onToggle(id) },
                label = { Text(name) }
            )
        }
    }
}
