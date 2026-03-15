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
import com.projecthub.android.ui.components.*
import com.projecthub.android.ui.theme.StatusClosed
import com.projecthub.android.ui.theme.StatusInProgress

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDetailScreen(
    projectId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToIssues: (Int) -> Unit,
    onNavigateToKanban: (Int) -> Unit,
    onNavigateToWiki: (Int) -> Unit,
    viewModel: ProjectViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.loadProject(projectId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.project?.name ?: "プロジェクト詳細") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadProject(projectId) }) {
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
                onRetry = { viewModel.loadProject(projectId) }
            )
            uiState.project != null -> {
                ProjectDetailContent(
                    project = uiState.project!!,
                    modifier = Modifier.padding(paddingValues),
                    onNavigateToIssues = onNavigateToIssues,
                    onNavigateToKanban = onNavigateToKanban,
                    onNavigateToWiki = onNavigateToWiki
                )
            }
        }
    }
}

@Composable
private fun ProjectDetailContent(
    project: ProjectDto,
    modifier: Modifier = Modifier,
    onNavigateToIssues: (Int) -> Unit,
    onNavigateToKanban: (Int) -> Unit,
    onNavigateToWiki: (Int) -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Header card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = project.name,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        StatusChip(
                            text = when (project.status) {
                                "active" -> "進行中"
                                "closed" -> "終了"
                                else -> project.status
                            },
                            color = when (project.status) {
                                "active" -> StatusInProgress
                                "closed" -> StatusClosed
                                else -> StatusInProgress
                            }
                        )
                    }

                    Text(
                        text = "識別子: ${project.identifier}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (!project.description.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = project.description,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }

        // Quick actions
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { onNavigateToIssues(project.id) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.BugReport, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("チケット")
                }
                OutlinedButton(
                    onClick = { onNavigateToKanban(project.id) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.ViewKanban, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("カンバン")
                }
                OutlinedButton(
                    onClick = { onNavigateToWiki(project.id) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Wiki")
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Project info
        item {
            SectionHeader("プロジェクト情報")
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(vertical = 8.dp)) {
                    InfoRow("会社", project.company?.name)
                    InfoRow("親プロジェクト", project.parent?.name)
                    InfoRow("期限", project.dueDate?.take(10))
                    InfoRow("備考", project.remarks)

                    project.count?.let { count ->
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            CountItem(count = count.issues, label = "チケット")
                            CountItem(count = count.wikiPages, label = "Wiki")
                            CountItem(count = count.timeEntries, label = "作業時間")
                        }
                    }
                }
            }
        }

        // Children
        if (!project.children.isNullOrEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("サブプロジェクト (${project.children.size})")
            }
            items(project.children) { child ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.SubdirectoryArrowRight,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(child.name, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        // Members
        if (!project.members.isNullOrEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("メンバー (${project.members.size}人)")
            }
            items(project.members) { member ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = member.user.fullName,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            member.roles?.let { roles ->
                                Text(
                                    text = roles.mapNotNull { it.role?.name }.joinToString(", "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }

        // Groups
        if (!project.groups.isNullOrEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("グループ (${project.groups.size})")
            }
            items(project.groups) { projectGroup ->
                projectGroup.group?.let { group ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 2.dp),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Group,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = group.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            group.members?.let { members ->
                                if (members.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = members.mapNotNull { it.user?.fullName }.joinToString(", "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 28.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CountItem(count: Int, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
