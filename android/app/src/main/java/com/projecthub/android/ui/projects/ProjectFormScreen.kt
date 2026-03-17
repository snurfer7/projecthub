package com.projecthub.android.ui.projects

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectCreateScreen(
    onNavigateBack: () -> Unit,
    viewModel: ProjectViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("プロジェクト登録") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
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

            ExposedDropdownMenuBox(
                expanded = companyExpanded,
                onExpandedChange = { companyExpanded = it }
            ) {
                OutlinedTextField(
                    value = uiState.companies.find { it.id == selectedCompanyId }?.name ?: "なし",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("企業") },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = companyExpanded) }
                )
                ExposedDropdownMenu(expanded = companyExpanded, onDismissRequest = { companyExpanded = false }) {
                    DropdownMenuItem(text = { Text("なし") }, onClick = { selectedCompanyId = null; companyExpanded = false })
                    uiState.companies.forEach { company ->
                        DropdownMenuItem(text = { Text(company.name) }, onClick = { selectedCompanyId = company.id; companyExpanded = false })
                    }
                }
            }

            ExposedDropdownMenuBox(
                expanded = parentExpanded,
                onExpandedChange = { parentExpanded = it }
            ) {
                OutlinedTextField(
                    value = uiState.projects.find { it.id == selectedParentId }?.name ?: "なし",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("親プロジェクト") },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = parentExpanded) }
                )
                ExposedDropdownMenu(expanded = parentExpanded, onDismissRequest = { parentExpanded = false }) {
                    DropdownMenuItem(text = { Text("なし") }, onClick = { selectedParentId = null; parentExpanded = false })
                    uiState.projects.forEach { project ->
                        DropdownMenuItem(text = { Text(project.name) }, onClick = { selectedParentId = project.id; parentExpanded = false })
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

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    if (identifier.isBlank()) { identifierError = true; return@Button }
                    viewModel.createProject(
                        name = name,
                        identifier = identifier,
                        description = description.ifBlank { null },
                        companyId = selectedCompanyId,
                        parentId = selectedParentId,
                        dueDate = dueDate.ifBlank { null },
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("作成", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
