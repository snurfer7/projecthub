package com.projecthub.android.ui.issues

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.IssueStatusDto
import com.projecthub.android.ui.components.*
import com.projecthub.android.ui.theme.*
import com.projecthub.android.ui.utils.IssueFilterCriteria
import com.projecthub.android.ui.utils.IssueTreeDisplayRow
import com.projecthub.android.ui.utils.buildIssueTreeDisplayRows

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueListScreen(
    projectId: Int? = null,
    onNavigateBack: (() -> Unit)? = null,
    onNavigateToIssue: (Int) -> Unit,
    onNavigateToCreateIssue: (Int?) -> Unit,
    viewModel: IssueViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()

    LaunchedEffect(projectId) {
        if (projectId != null) {
            viewModel.setProjectFilter(projectId)
        } else {
            viewModel.loadIssues()
        }
        viewModel.loadMetaOptions(projectId)
        viewModel.loadSavedSearches()
    }

    var showFilterSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (projectId != null) "チケット" else "すべてのチケット") },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { showFilterSheet = true }) {
                        BadgedBox(badge = {
                            if (uiState.criteria.activeCount > 0) {
                                Badge { Text(uiState.criteria.activeCount.toString()) }
                            }
                        }) {
                            Icon(Icons.Default.FilterList, contentDescription = "フィルター")
                        }
                    }
                    IconButton(onClick = { viewModel.loadIssues(projectId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToCreateIssue(projectId) }
            ) {
                Icon(Icons.Default.Add, contentDescription = "チケット作成")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Active filters
            if (uiState.criteria.activeCount > 0) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val criteria = uiState.criteria
                    if (criteria.trackerIds.isNotEmpty()) {
                        item {
                            ActiveFilterChip(
                                label = "トラッカー(${criteria.trackerIds.size})",
                                onClear = { viewModel.setCriteria(criteria.copy(trackerIds = emptySet())) }
                            )
                        }
                    }
                    if (criteria.statusIds.isNotEmpty()) {
                        item {
                            ActiveFilterChip(
                                label = "ステータス(${criteria.statusIds.size})",
                                onClear = { viewModel.setCriteria(criteria.copy(statusIds = emptySet())) }
                            )
                        }
                    }
                    if (criteria.priorityIds.isNotEmpty()) {
                        item {
                            ActiveFilterChip(
                                label = "優先度(${criteria.priorityIds.size})",
                                onClear = { viewModel.setCriteria(criteria.copy(priorityIds = emptySet())) }
                            )
                        }
                    }
                    if (criteria.assignedToIds.isNotEmpty() || criteria.assignedToGroupIds.isNotEmpty()) {
                        item {
                            ActiveFilterChip(
                                label = "担当者(${criteria.assignedToIds.size + criteria.assignedToGroupIds.size})",
                                onClear = { viewModel.setCriteria(criteria.copy(assignedToIds = emptySet(), assignedToGroupIds = emptySet())) }
                            )
                        }
                    }
                    if (criteria.dueDateStart.isNotBlank() || criteria.dueDateEnd.isNotBlank()) {
                        item {
                            ActiveFilterChip(
                                label = "期限日",
                                onClear = { viewModel.setCriteria(criteria.copy(dueDateStart = "", dueDateEnd = "")) }
                            )
                        }
                    }
                }
            }

            when {
                uiState.isLoading -> LoadingScreen()
                uiState.error != null -> ErrorScreen(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadIssues(projectId) }
                )
                uiState.issues.isEmpty() -> EmptyScreen("チケットがありません")
                else -> {
                    Text(
                        text = "${uiState.issues.size}件",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    val treeRows = remember(uiState.issues, uiState.collapsedIssueIds) {
                        buildIssueTreeDisplayRows(uiState.issues, uiState.collapsedIssueIds)
                    }
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 80.dp)
                    ) {
                        items(treeRows, key = { it.issue.id }) { row ->
                            IssueListItem(
                                row = row,
                                isCollapsed = row.issue.id in uiState.collapsedIssueIds,
                                onToggleCollapse = { viewModel.toggleIssueCollapsed(row.issue.id) },
                                onClick = { onNavigateToIssue(row.issue.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showFilterSheet) {
        IssueFilterBottomSheet(
            metaOptions = uiState.metaOptions,
            criteria = uiState.criteria,
            savedSearchSlot = {
                SavedSearchSection(
                    savedSearches = uiState.savedSearches,
                    onApply = { viewModel.setCriteria(it.filter.toIssueFilterCriteriaOrNull() ?: IssueFilterCriteria()) },
                    onSetDefault = { viewModel.setSavedSearchDefault(it) },
                    onDelete = { viewModel.deleteSavedSearch(it) },
                    onSaveCurrent = { name, isDefault -> viewModel.saveCurrentSearch(name, isDefault) }
                )
            },
            onApply = { viewModel.setCriteria(it) },
            onDismiss = { showFilterSheet = false }
        )
    }
}

@Composable
private fun ActiveFilterChip(label: String, onClear: () -> Unit) {
    FilterChip(
        selected = true,
        onClick = onClear,
        label = { Text(label) },
        trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp)) }
    )
}

@Composable
private fun IssueListItem(
    row: IssueTreeDisplayRow,
    isCollapsed: Boolean,
    onToggleCollapse: () -> Unit,
    onClick: () -> Unit
) {
    val issue = row.issue
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = 16.dp + (row.depth * 16).dp,
                end = 16.dp,
                top = 4.dp,
                bottom = 4.dp
            )
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.Top) {
                    if (row.hasChildren) {
                        IconButton(
                            onClick = onToggleCollapse,
                            modifier = Modifier.size(20.dp)
                        ) {
                            Icon(
                                imageVector = if (isCollapsed) Icons.Default.KeyboardArrowRight else Icons.Default.KeyboardArrowDown,
                                contentDescription = if (isCollapsed) "展開" else "折りたたむ"
                            )
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text(
                        text = "#${issue.id} ${issue.subject}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
                issue.status?.let { status ->
                    Spacer(modifier = Modifier.width(8.dp))
                    StatusChip(
                        text = status.name,
                        color = if (status.isClosed) StatusClosed else StatusOpen
                    )
                }
            }

            if (row.hasChildren) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "子${issue.count?.children ?: 0}件・開始/終了日はチケットから自動集計",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                issue.tracker?.let {
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = it.name,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                issue.priority?.let {
                    StatusChip(
                        text = it.name,
                        color = getPriorityColor(it.name)
                    )
                }
                issue.assignedTo?.let {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = it.fullName,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (issue.doneRatio > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    LinearProgressIndicator(
                        progress = { issue.doneRatio / 100f },
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                    )
                    Text(
                        text = "${issue.doneRatio}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

fun getPriorityColor(priorityName: String): Color {
    return when {
        priorityName.contains("低") || priorityName.lowercase().contains("low") -> PriorityLow
        priorityName.contains("高") || priorityName.lowercase().contains("high") -> PriorityHigh
        priorityName.contains("急") || priorityName.lowercase().contains("urgent") -> PriorityUrgent
        priorityName.contains("即") || priorityName.lowercase().contains("immediate") -> PriorityImmediate
        else -> PriorityNormal
    }
}
