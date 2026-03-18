package com.projecthub.android.ui.kanban

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.IssueStatusDto
import com.projecthub.android.ui.components.LoadingScreen
import com.projecthub.android.ui.components.ErrorScreen
import com.projecthub.android.ui.issues.getPriorityColor
import com.projecthub.android.ui.theme.StatusClosed
import com.projecthub.android.ui.theme.StatusOpen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KanbanScreen(
    projectId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToIssue: (Int) -> Unit,
    viewModel: KanbanViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.loadKanban(projectId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("カンバンボード") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadKanban(projectId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> LoadingScreen()
            uiState.error != null -> ErrorScreen(
                message = uiState.error!!,
                onRetry = { viewModel.loadKanban(projectId) }
            )
            else -> {
                // Horizontal scrollable kanban
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.columns.entries.sortedBy { it.key.position }.forEach { (status, issues) ->
                        KanbanColumn(
                            status = status,
                            issues = issues,
                            allStatuses = uiState.metaOptions?.statuses ?: emptyList(),
                            updatingIssueId = uiState.updatingIssueId,
                            onIssueClick = onNavigateToIssue,
                            onMoveIssue = { issue, newStatusId ->
                                viewModel.moveIssueToStatus(issue, newStatusId, projectId)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun KanbanColumn(
    status: IssueStatusDto,
    issues: List<IssueDto>,
    allStatuses: List<IssueStatusDto>,
    updatingIssueId: Int?,
    onIssueClick: (Int) -> Unit,
    onMoveIssue: (IssueDto, Int) -> Unit
) {
    val columnColor = if (status.isClosed)
        MaterialTheme.colorScheme.surfaceVariant
    else
        MaterialTheme.colorScheme.surface

    Column(
        modifier = Modifier
            .width(260.dp)
            .fillMaxHeight()
    ) {
        // Column header
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = if (status.isClosed)
                MaterialTheme.colorScheme.outlineVariant
            else
                MaterialTheme.colorScheme.primaryContainer,
            shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = status.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (status.isClosed)
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else
                        MaterialTheme.colorScheme.onPrimaryContainer
                )
                Badge(
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Text(
                        text = issues.size.toString(),
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontSize = 11.sp
                    )
                }
            }
        }

        // Cards
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(
                    color = columnColor,
                    shape = RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp)
                )
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(issues) { issue ->
                KanbanCard(
                    issue = issue,
                    allStatuses = allStatuses,
                    isUpdating = updatingIssueId == issue.id,
                    onClick = { onIssueClick(issue.id) },
                    onMoveToStatus = { newStatusId -> onMoveIssue(issue, newStatusId) }
                )
            }
        }
    }
}

@Composable
private fun KanbanCard(
    issue: IssueDto,
    allStatuses: List<IssueStatusDto>,
    isUpdating: Boolean,
    onClick: () -> Unit,
    onMoveToStatus: (Int) -> Unit
) {
    var showStatusMenu by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = "#${issue.id}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 2.dp)
                )
                if (isUpdating) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                } else {
                    Box {
                        IconButton(
                            onClick = { showStatusMenu = true },
                            modifier = Modifier.size(20.dp)
                        ) {
                            Icon(
                                Icons.Default.SwapHoriz,
                                contentDescription = "ステータス変更",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        DropdownMenu(
                            expanded = showStatusMenu,
                            onDismissRequest = { showStatusMenu = false }
                        ) {
                            allStatuses.filter { it.id != issue.statusId }.forEach { status ->
                                DropdownMenuItem(
                                    text = { Text(status.name) },
                                    onClick = {
                                        showStatusMenu = false
                                        onMoveToStatus(status.id)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            Text(
                text = issue.subject,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium,
                maxLines = 3
            )

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                issue.tracker?.let {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = it.name,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                issue.priority?.let {
                    val color = getPriorityColor(it.name)
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = color.copy(alpha = 0.15f)
                    ) {
                        Text(
                            text = it.name,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = color
                        )
                    }
                }
            }

            issue.assignedTo?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    Text(
                        text = it.fullName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (issue.doneRatio > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { issue.doneRatio / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                )
            }
        }
    }
}
