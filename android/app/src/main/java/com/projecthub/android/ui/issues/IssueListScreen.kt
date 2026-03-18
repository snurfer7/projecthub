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
                        Icon(Icons.Default.FilterList, contentDescription = "フィルター")
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
            val hasFilters = uiState.selectedStatusId != null ||
                    uiState.selectedTrackerId != null ||
                    uiState.selectedPriorityId != null

            if (hasFilters) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.selectedStatusId?.let { sid ->
                        val statusName = uiState.metaOptions?.statuses?.find { it.id == sid }?.name ?: "ステータス"
                        item {
                            FilterChip(
                                selected = true,
                                onClick = { viewModel.setStatusFilter(null) },
                                label = { Text(statusName) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            )
                        }
                    }
                    uiState.selectedTrackerId?.let { tid ->
                        val trackerName = uiState.metaOptions?.trackers?.find { it.id == tid }?.name ?: "トラッカー"
                        item {
                            FilterChip(
                                selected = true,
                                onClick = { viewModel.setTrackerFilter(null) },
                                label = { Text(trackerName) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            )
                        }
                    }
                    uiState.selectedPriorityId?.let { pid ->
                        val priorityName = uiState.metaOptions?.priorities?.find { it.id == pid }?.name ?: "優先度"
                        item {
                            FilterChip(
                                selected = true,
                                onClick = { viewModel.setPriorityFilter(null) },
                                label = { Text(priorityName) },
                                trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp)) }
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
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 80.dp)
                    ) {
                        items(uiState.issues) { issue ->
                            IssueListItem(
                                issue = issue,
                                onClick = { onNavigateToIssue(issue.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showFilterSheet) {
        FilterBottomSheet(
            metaOptions = uiState.metaOptions,
            selectedStatusId = uiState.selectedStatusId,
            selectedTrackerId = uiState.selectedTrackerId,
            selectedPriorityId = uiState.selectedPriorityId,
            onStatusSelected = { viewModel.setStatusFilter(it) },
            onTrackerSelected = { viewModel.setTrackerFilter(it) },
            onPrioritySelected = { viewModel.setPriorityFilter(it) },
            onDismiss = { showFilterSheet = false }
        )
    }
}

@Composable
private fun IssueListItem(
    issue: IssueDto,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterBottomSheet(
    metaOptions: com.projecthub.android.data.api.models.IssueMetaOptions?,
    selectedStatusId: Int?,
    selectedTrackerId: Int?,
    selectedPriorityId: Int?,
    onStatusSelected: (Int?) -> Unit,
    onTrackerSelected: (Int?) -> Unit,
    onPrioritySelected: (Int?) -> Unit,
    onDismiss: () -> Unit
) {
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

            metaOptions?.let { options ->
                // Status filter
                Text(
                    text = "ステータス",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedStatusId == null,
                            onClick = { onStatusSelected(null) },
                            label = { Text("すべて") }
                        )
                    }
                    items(options.statuses) { status ->
                        FilterChip(
                            selected = selectedStatusId == status.id,
                            onClick = { onStatusSelected(if (selectedStatusId == status.id) null else status.id) },
                            label = { Text(status.name) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Tracker filter
                Text(
                    text = "トラッカー",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedTrackerId == null,
                            onClick = { onTrackerSelected(null) },
                            label = { Text("すべて") }
                        )
                    }
                    items(options.trackers) { tracker ->
                        FilterChip(
                            selected = selectedTrackerId == tracker.id,
                            onClick = { onTrackerSelected(if (selectedTrackerId == tracker.id) null else tracker.id) },
                            label = { Text(tracker.name) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Priority filter
                Text(
                    text = "優先度",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedPriorityId == null,
                            onClick = { onPrioritySelected(null) },
                            label = { Text("すべて") }
                        )
                    }
                    items(options.priorities) { priority ->
                        FilterChip(
                            selected = selectedPriorityId == priority.id,
                            onClick = { onPrioritySelected(if (selectedPriorityId == priority.id) null else priority.id) },
                            label = { Text(priority.name) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("適用")
            }
            Spacer(modifier = Modifier.height(16.dp))
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
