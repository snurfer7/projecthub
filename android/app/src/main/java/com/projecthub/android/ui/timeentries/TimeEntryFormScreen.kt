package com.projecthub.android.ui.timeentries

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
import com.projecthub.android.data.api.models.CreateTimeEntryRequest
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeEntryFormScreen(
    projectId: Int? = null,
    onNavigateBack: () -> Unit,
    onSaveSuccess: () -> Unit,
    viewModel: TimeEntriesViewModel = hiltViewModel()
) {
    val formUiState by viewModel.formUiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.resetFormState()
    }

    LaunchedEffect(formUiState.isSuccess) {
        if (formUiState.isSuccess) {
            onSaveSuccess()
        }
    }

    val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

    var hours by remember { mutableStateOf("") }
    var activity by remember { mutableStateOf("開発") }
    var spentOn by remember { mutableStateOf(today) }
    var comments by remember { mutableStateOf("") }

    val commonActivities = listOf("開発", "設計", "レビュー", "テスト", "ドキュメント", "会議", "その他")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("作業時間を記録") },
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

            // Hours
            OutlinedTextField(
                value = hours,
                onValueChange = { hours = it },
                label = { Text("作業時間 (時間) *") },
                placeholder = { Text("例: 2.5") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Activity
            Text(
                text = "作業種別 *",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            var expanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it }
            ) {
                OutlinedTextField(
                    value = activity,
                    onValueChange = { activity = it },
                    label = { Text("作業種別") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    commonActivities.forEach { act ->
                        DropdownMenuItem(
                            text = { Text(act) },
                            onClick = {
                                activity = act
                                expanded = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                        )
                    }
                }
            }

            // Date
            OutlinedTextField(
                value = spentOn,
                onValueChange = { spentOn = it },
                label = { Text("作業日 *") },
                placeholder = { Text("YYYY-MM-DD") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Comments
            OutlinedTextField(
                value = comments,
                onValueChange = { comments = it },
                label = { Text("コメント") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    val hoursDouble = hours.toDoubleOrNull() ?: return@Button
                    if (projectId == null || spentOn.isBlank() || activity.isBlank()) return@Button
                    viewModel.createTimeEntry(
                        CreateTimeEntryRequest(
                            projectId = projectId,
                            issueId = null,
                            hours = hoursDouble,
                            activity = activity,
                            spentOn = spentOn,
                            comments = comments.ifBlank { null }
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !formUiState.isSaving && hours.isNotBlank() && hours.toDoubleOrNull() != null
            ) {
                if (formUiState.isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("記録する", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
