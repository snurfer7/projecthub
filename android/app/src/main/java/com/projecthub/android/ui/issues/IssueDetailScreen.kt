package com.projecthub.android.ui.issues

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
import com.projecthub.android.data.api.models.IssueChildDto
import com.projecthub.android.data.api.models.IssueCommentDto
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.ui.components.*
import com.projecthub.android.ui.theme.StatusClosed
import com.projecthub.android.ui.theme.StatusOpen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueDetailScreen(
    issueId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Int) -> Unit,
    onNavigateToIssue: (Int) -> Unit = {},
    viewModel: IssueViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()
    var commentText by remember { mutableStateOf("") }

    LaunchedEffect(issueId) {
        viewModel.loadIssue(issueId)
    }

    LaunchedEffect(uiState.successMessage) {
        if (uiState.successMessage != null) {
            kotlinx.coroutines.delay(2000)
            viewModel.clearDetailMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("チケット #${issueId}") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    uiState.issue?.let {
                        IconButton(onClick = { onNavigateToEdit(issueId) }) {
                            Icon(Icons.Default.Edit, contentDescription = "編集")
                        }
                    }
                    IconButton(onClick = { viewModel.loadIssue(issueId) }) {
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
                onRetry = { viewModel.loadIssue(issueId) }
            )
            uiState.issue != null -> {
                IssueDetailContent(
                    issue = uiState.issue!!,
                    commentText = commentText,
                    onCommentTextChange = { commentText = it },
                    onAddComment = {
                        viewModel.addComment(issueId, commentText)
                        commentText = ""
                    },
                    isSaving = uiState.isSaving,
                    successMessage = uiState.successMessage,
                    onNavigateToIssue = onNavigateToIssue,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun IssueDetailContent(
    issue: IssueDto,
    commentText: String,
    onCommentTextChange: (String) -> Unit,
    onAddComment: () -> Unit,
    isSaving: Boolean,
    successMessage: String?,
    onNavigateToIssue: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Success message
        successMessage?.let {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(it, color = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                }
            }
        }

        // Parent breadcrumb
        issue.parent?.let { parent ->
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                        .clickable { onNavigateToIssue(parent.id) },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.SubdirectoryArrowLeft,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "親: #${parent.id} ${parent.subject}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Header
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = issue.subject,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        issue.tracker?.let {
                            Surface(
                                shape = MaterialTheme.shapes.small,
                                color = MaterialTheme.colorScheme.primaryContainer
                            ) {
                                Text(
                                    text = it.name,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                        issue.status?.let { status ->
                            StatusChip(
                                text = status.name,
                                color = if (status.isClosed) StatusClosed else StatusOpen
                            )
                        }
                        issue.priority?.let { priority ->
                            StatusChip(
                                text = priority.name,
                                color = getPriorityColor(priority.name)
                            )
                        }
                    }
                }
            }
        }

        // Details
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(vertical = 8.dp)) {
                    InfoRow("プロジェクト", issue.project?.name)
                    InfoRow("担当者", issue.assignedTo?.fullName ?: issue.assignedToGroup?.name)
                    InfoRow("作成者", issue.author?.fullName)
                    val hasChildren = (issue.count?.children ?: 0) > 0
                    val aggregatedSuffix = if (hasChildren) "（子から集計）" else ""
                    InfoRow("開始日", issue.startDate?.take(10)?.let { "$it$aggregatedSuffix" })
                    InfoRow("終了日", issue.endDate?.take(10)?.let { "$it$aggregatedSuffix" })
                    InfoRow("期限日", issue.dueDate?.take(10))
                    InfoRow("予定工数", issue.estimatedHours?.let { "${it}h" })
                    InfoRow("進捗", "${issue.doneRatio}%")
                }
            }
        }

        // Children
        val children = issue.children.orEmpty()
        if (children.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("子チケット (${children.size})")
            }
            items(children) { child ->
                IssueChildItem(child = child, onClick = { onNavigateToIssue(child.id) })
            }
        }

        // Progress bar
        if (issue.doneRatio > 0) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("進捗", style = MaterialTheme.typography.bodySmall)
                        Text("${issue.doneRatio}%", style = MaterialTheme.typography.bodySmall)
                    }
                    LinearProgressIndicator(
                        progress = { issue.doneRatio / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                    )
                }
            }
        }

        // Description
        if (!issue.description.isNullOrBlank()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("説明")
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Text(
                        text = issue.description,
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        // Comments
        val comments = issue.comments ?: emptyList()
        item {
            Spacer(modifier = Modifier.height(8.dp))
            SectionHeader("コメント (${comments.size})")
        }

        items(comments) { comment ->
            IssueCommentItem(comment = comment)
        }

        // Add comment
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    OutlinedTextField(
                        value = commentText,
                        onValueChange = onCommentTextChange,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("コメントを入力...") },
                        minLines = 3,
                        maxLines = 6
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onAddComment,
                        enabled = commentText.isNotBlank() && !isSaving,
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("コメント追加")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun IssueChildItem(child: IssueChildDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "#${child.id} ${child.subject}",
                style = MaterialTheme.typography.bodyMedium
            )
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun IssueCommentItem(comment: IssueCommentDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = comment.user?.fullName ?: "Unknown",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
                comment.createdAt?.take(10)?.let { date ->
                    Text(
                        text = date,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = comment.content,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}
