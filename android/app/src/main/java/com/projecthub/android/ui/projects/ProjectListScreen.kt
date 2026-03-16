package com.projecthub.android.ui.projects

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectListScreen(
    onNavigateToProject: (Int) -> Unit,
    viewModel: ProjectViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }

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
            FloatingActionButton(onClick = { showCreateDialog = true }) {
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
                    LazyColumn(
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(uiState.filteredProjects) { project ->
                            ProjectListItem(
                                project = project,
                                onClick = { onNavigateToProject(project.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        ProjectCreateDialog(
            projects = uiState.projects,
            companies = uiState.companies,
            isCreating = uiState.isCreating,
            onDismiss = { showCreateDialog = false },
            onSubmit = { name, identifier, description, companyId, parentId, dueDate ->
                viewModel.createProject(
                    name = name,
                    identifier = identifier,
                    description = description,
                    companyId = companyId,
                    parentId = parentId,
                    dueDate = dueDate,
                    onSuccess = { showCreateDialog = false },
                    onError = {}
                )
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProjectCreateDialog(
    projects: List<ProjectDto>,
    companies: List<com.projecthub.android.data.api.models.CompanyDto>,
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (name: String, identifier: String, description: String?, companyId: Int?, parentId: Int?, dueDate: String?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var identifier by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("") }
    var selectedCompanyId by remember { mutableStateOf<Int?>(null) }
    var selectedParentId by remember { mutableStateOf<Int?>(null) }
    var companyExpanded by remember { mutableStateOf(false) }
    var parentExpanded by remember { mutableStateOf(false) }
    var nameError by remember { mutableStateOf(false) }
    var identifierError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("プロジェクト登録") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; nameError = false },
                    label = { Text("プロジェクト名 *") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = nameError,
                    supportingText = if (nameError) { { Text("必須項目です") } } else null,
                    singleLine = true
                )
                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it; identifierError = false },
                    label = { Text("識別子 *") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = identifierError,
                    supportingText = if (identifierError) { { Text("必須（小文字英数字とハイフン）") } } else null,
                    singleLine = true,
                    placeholder = { Text("例: my-project") }
                )

                // 企業選択
                ExposedDropdownMenuBox(
                    expanded = companyExpanded,
                    onExpandedChange = { companyExpanded = it }
                ) {
                    OutlinedTextField(
                        value = companies.find { it.id == selectedCompanyId }?.name ?: "なし",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("企業") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = companyExpanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = companyExpanded,
                        onDismissRequest = { companyExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("なし") },
                            onClick = { selectedCompanyId = null; companyExpanded = false }
                        )
                        companies.forEach { company ->
                            DropdownMenuItem(
                                text = { Text(company.name) },
                                onClick = { selectedCompanyId = company.id; companyExpanded = false }
                            )
                        }
                    }
                }

                // 親プロジェクト選択
                ExposedDropdownMenuBox(
                    expanded = parentExpanded,
                    onExpandedChange = { parentExpanded = it }
                ) {
                    OutlinedTextField(
                        value = projects.find { it.id == selectedParentId }?.name ?: "なし",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("親プロジェクト") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = parentExpanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = parentExpanded,
                        onDismissRequest = { parentExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("なし") },
                            onClick = { selectedParentId = null; parentExpanded = false }
                        )
                        projects.forEach { project ->
                            DropdownMenuItem(
                                text = { Text(project.name) },
                                onClick = { selectedParentId = project.id; parentExpanded = false }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = { Text("期限日") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("YYYY-MM-DD") }
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("説明") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 5
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    if (identifier.isBlank()) { identifierError = true; return@Button }
                    onSubmit(name, identifier, description.ifBlank { null }, selectedCompanyId, selectedParentId, dueDate.ifBlank { null })
                },
                enabled = !isCreating
            ) {
                if (isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Text("作成")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("キャンセル") }
        }
    )
}

@Composable
private fun ProjectListItem(
    project: ProjectDto,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
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
