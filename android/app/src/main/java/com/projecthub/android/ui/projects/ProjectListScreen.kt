package com.projecthub.android.ui.projects

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.ProjectDto
import com.projecthub.android.ui.components.EmptyScreen
import com.projecthub.android.ui.components.ErrorScreen
import com.projecthub.android.ui.components.LoadingScreen
import com.projecthub.android.ui.components.StatusChip
import com.projecthub.android.ui.theme.StatusClosed
import com.projecthub.android.ui.theme.StatusInProgress
import com.projecthub.android.ui.theme.StatusOpen
import com.projecthub.android.ui.utils.ProjectTreeDisplayRow
import com.projecthub.android.ui.utils.buildProjectTreeDisplayRows

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectListScreen(
    onNavigateToProject: (Int) -> Unit,
    onNavigateToCreate: () -> Unit = {},
    viewModel: ProjectViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("プロジェクト") },
                actions = {
                    IconButton(onClick = { viewModel.loadProjects() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreate) {
                Icon(Icons.Default.Add, contentDescription = "新規プロジェクト")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search bar
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.updateSearchQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("プロジェクトを検索...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "検索") },
                trailingIcon = {
                    if (uiState.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "クリア")
                        }
                    }
                },
                singleLine = true
            )

            when {
                uiState.isLoading -> LoadingScreen()
                uiState.error != null -> ErrorScreen(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadProjects() }
                )
                uiState.filteredProjects.isEmpty() -> EmptyScreen(
                    if (uiState.searchQuery.isNotBlank()) "検索結果がありません" else "プロジェクトがありません"
                )
                else -> {
                    val treeRows = remember(uiState.filteredProjects, uiState.collapsedProjectIds) {
                        buildProjectTreeDisplayRows(uiState.filteredProjects, uiState.collapsedProjectIds)
                    }
                    LazyColumn(
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(treeRows, key = { it.project.id }) { row ->
                            ProjectListItem(
                                row = row,
                                isCollapsed = row.project.id in uiState.collapsedProjectIds,
                                onToggleCollapse = { viewModel.toggleProjectCollapsed(row.project.id) },
                                onClick = { onNavigateToProject(row.project.id) }
                            )
                        }
                    }
                }
            }
        }
    }

}

@Composable
private fun ProjectListItem(
    row: ProjectTreeDisplayRow,
    isCollapsed: Boolean,
    onToggleCollapse: () -> Unit,
    onClick: () -> Unit
) {
    val project = row.project
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
        Column(modifier = Modifier.padding(16.dp)) {
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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = project.name,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = project.identifier,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                StatusChip(
                    text = when (project.status) {
                        "active" -> "進行中"
                        "closed" -> "終了"
                        else -> project.status
                    },
                    color = when (project.status) {
                        "active" -> StatusInProgress
                        "closed" -> StatusClosed
                        else -> StatusOpen
                    }
                )
            }

            if (!project.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = project.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                project.company?.let {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Business,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = it.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (row.depth == 0) {
                    project.parent?.let {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.AccountTree,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = it.name,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                if (row.hasChildren) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.AccountTree,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "子${project.children?.size ?: 0}件",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                project.count?.let { count ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.BugReport,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "${count.issues}件",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
