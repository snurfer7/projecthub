package com.projecthub.android.ui.issues

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.CreateIssueRequest
import com.projecthub.android.data.api.models.UpdateIssueRequest
import com.projecthub.android.data.api.models.parentIdBody
import com.projecthub.android.ui.components.DatePickerField
import com.projecthub.android.ui.components.LoadingScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IssueFormScreen(
    projectId: Int? = null,
    issueId: Int? = null,
    onNavigateBack: () -> Unit,
    onSaveSuccess: (Int) -> Unit,
    viewModel: IssueViewModel = hiltViewModel()
) {
    val formUiState by viewModel.formUiState.collectAsState()
    val detailUiState by viewModel.detailUiState.collectAsState()
    val isEditMode = issueId != null

    LaunchedEffect(projectId, issueId) {
        viewModel.loadFormMetaOptions(projectId)
        if (issueId != null) {
            viewModel.loadIssue(issueId)
        }
        viewModel.resetFormState()
    }

    LaunchedEffect(formUiState.isSuccess) {
        if (formUiState.isSuccess && formUiState.savedIssueId != null) {
            onSaveSuccess(formUiState.savedIssueId!!)
        }
    }

    // Form state
    val issue = if (isEditMode) detailUiState.issue else null
    val hasChildren = (issue?.count?.children ?: 0) > 0
    val effProjectId = projectId ?: issue?.projectId

    var subject by remember(issue) { mutableStateOf(issue?.subject ?: "") }
    var description by remember(issue) { mutableStateOf(issue?.description ?: "") }
    var selectedTrackerId by remember(issue) { mutableStateOf(issue?.trackerId) }
    var selectedStatusId by remember(issue) { mutableStateOf(issue?.statusId) }
    var selectedPriorityId by remember(issue) { mutableStateOf(issue?.priorityId) }
    var selectedAssigneeId by remember(issue) { mutableStateOf(issue?.assignedToId) }
    var selectedParentId by remember(issue) { mutableStateOf(issue?.parentId) }
    var startDate by remember(issue) { mutableStateOf(issue?.startDate?.take(10) ?: "") }
    var endDate by remember(issue) { mutableStateOf(issue?.endDate?.take(10) ?: "") }
    var dueDate by remember(issue) { mutableStateOf(issue?.dueDate?.take(10) ?: "") }
    var estimatedHours by remember(issue) { mutableStateOf(issue?.estimatedHours?.toString() ?: "") }
    var doneRatio by remember(issue) { mutableStateOf(issue?.doneRatio?.toString() ?: "0") }

    LaunchedEffect(effProjectId, issueId) {
        if (effProjectId != null) {
            viewModel.loadParentCandidates(effProjectId, issueId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEditMode) "チケット編集" else "チケット作成") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (formUiState.isLoading || (isEditMode && detailUiState.isLoading)) {
            LoadingScreen()
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                formUiState.error?.let { error ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                    ) {
                        Text(
                            text = error,
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }

                // Subject
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("タイトル *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Tracker
                formUiState.metaOptions?.trackers?.let { trackers ->
                    DropdownSelector(
                        label = "トラッカー *",
                        options = trackers.map { it.id to it.name },
                        selectedId = selectedTrackerId,
                        onSelect = { selectedTrackerId = it }
                    )
                }

                // Status
                formUiState.metaOptions?.statuses?.let { statuses ->
                    DropdownSelector(
                        label = "ステータス *",
                        options = statuses.map { it.id to it.name },
                        selectedId = selectedStatusId,
                        onSelect = { selectedStatusId = it },
                        enabled = !hasChildren,
                        supportingText = if (hasChildren) "子チケットから自動集計されます" else null
                    )
                }

                // Priority
                formUiState.metaOptions?.priorities?.let { priorities ->
                    DropdownSelector(
                        label = "優先度 *",
                        options = priorities.map { it.id to it.name },
                        selectedId = selectedPriorityId,
                        onSelect = { selectedPriorityId = it }
                    )
                }

                // Assignee
                formUiState.metaOptions?.users?.let { users ->
                    DropdownSelector(
                        label = "担当者",
                        options = listOf(null to "未割り当て") + users.map { it.id to it.fullName },
                        selectedId = selectedAssigneeId,
                        onSelect = { selectedAssigneeId = it }
                    )
                }

                // Parent issue (only once the project is known)
                if (effProjectId != null) {
                    DropdownSelector(
                        label = "親チケット",
                        options = listOf(null to "なし") + formUiState.parentCandidates.map { it.id to "#${it.id} ${it.subject}" },
                        selectedId = selectedParentId,
                        onSelect = { selectedParentId = it }
                    )
                }

                // Dates
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DatePickerField(
                        value = startDate,
                        onValueChange = { startDate = it },
                        label = "開始日",
                        modifier = Modifier.weight(1f),
                        placeholder = "YYYY-MM-DD",
                        enabled = !hasChildren,
                        supportingText = if (hasChildren) "子から集計" else null
                    )
                    DatePickerField(
                        value = endDate,
                        onValueChange = { endDate = it },
                        label = "終了日",
                        modifier = Modifier.weight(1f),
                        placeholder = "YYYY-MM-DD",
                        enabled = !hasChildren,
                        supportingText = if (hasChildren) "子から集計" else null
                    )
                }
                DatePickerField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = "期限日",
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = "YYYY-MM-DD"
                )

                // Estimated hours
                OutlinedTextField(
                    value = estimatedHours,
                    onValueChange = { estimatedHours = it },
                    label = { Text("予定工数 (時間)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Done ratio (edit mode only)
                if (isEditMode) {
                    Text(
                        text = "進捗: ${doneRatio}%",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Slider(
                        value = doneRatio.toFloatOrNull() ?: 0f,
                        onValueChange = { doneRatio = it.toInt().toString() },
                        valueRange = 0f..100f,
                        steps = 9,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("説明") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4,
                    maxLines = 8
                )

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = {
                        if (effProjectId == null || subject.isBlank() || selectedTrackerId == null ||
                            selectedStatusId == null || selectedPriorityId == null) {
                            return@Button
                        }

                        if (isEditMode && issueId != null) {
                            val parentChanged = selectedParentId != issue?.parentId
                            viewModel.updateIssue(
                                issueId,
                                UpdateIssueRequest(
                                    trackerId = selectedTrackerId,
                                    statusId = if (hasChildren) null else selectedStatusId,
                                    priorityId = selectedPriorityId,
                                    assignedToId = selectedAssigneeId,
                                    assignedToGroupId = null,
                                    subject = subject,
                                    description = description.ifBlank { null },
                                    startDate = if (hasChildren) null else startDate.ifBlank { null },
                                    endDate = if (hasChildren) null else endDate.ifBlank { null },
                                    dueDate = dueDate.ifBlank { null },
                                    estimatedHours = estimatedHours.toIntOrNull(),
                                    doneRatio = doneRatio.toIntOrNull(),
                                    parentId = if (parentChanged) parentIdBody(selectedParentId) else null
                                )
                            )
                        } else {
                            viewModel.createIssue(
                                CreateIssueRequest(
                                    projectId = effProjectId,
                                    trackerId = selectedTrackerId!!,
                                    statusId = selectedStatusId!!,
                                    priorityId = selectedPriorityId!!,
                                    assignedToId = selectedAssigneeId,
                                    assignedToGroupId = null,
                                    subject = subject,
                                    description = description.ifBlank { null },
                                    startDate = startDate.ifBlank { null },
                                    endDate = endDate.ifBlank { null },
                                    dueDate = dueDate.ifBlank { null },
                                    estimatedHours = estimatedHours.toIntOrNull(),
                                    parentId = selectedParentId
                                )
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !formUiState.isSaving && subject.isNotBlank()
                ) {
                    if (formUiState.isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(if (isEditMode) "更新" else "作成", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownSelector(
    label: String,
    options: List<Pair<Int?, String>>,
    selectedId: Int?,
    onSelect: (Int?) -> Unit,
    enabled: Boolean = true,
    supportingText: String? = null
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedName = options.find { it.first == selectedId }?.second ?: ""

    ExposedDropdownMenuBox(
        expanded = expanded && enabled,
        onExpandedChange = { if (enabled) expanded = it }
    ) {
        OutlinedTextField(
            value = selectedName,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            supportingText = supportingText?.let { { Text(it) } },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded && enabled)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { (id, name) ->
                DropdownMenuItem(
                    text = { Text(name) },
                    onClick = {
                        onSelect(id)
                        expanded = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
            }
        }
    }
}
