package com.projecthub.android.ui.issues

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.projecthub.android.data.api.models.SavedSearchDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedSearchSection(
    savedSearches: List<SavedSearchDto>,
    onApply: (SavedSearchDto) -> Unit,
    onSetDefault: (SavedSearchDto) -> Unit,
    onDelete: (SavedSearchDto) -> Unit,
    onSaveCurrent: (name: String, isDefault: Boolean) -> Unit
) {
    var showSaveDialog by remember { mutableStateOf(false) }
    var menuTargetId by remember { mutableStateOf<Int?>(null) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "保存済み条件",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            TextButton(onClick = { showSaveDialog = true }) {
                Text("現在の条件を保存")
            }
        }
        if (savedSearches.isEmpty()) {
            Text(
                text = "保存済み条件はありません",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(savedSearches, key = { it.id }) { search ->
                    Box {
                        FilterChip(
                            selected = false,
                            onClick = { onApply(search) },
                            label = { Text(search.name) },
                            leadingIcon = if (search.isDefault) {
                                { Icon(Icons.Default.Star, contentDescription = "既定", modifier = Modifier.size(16.dp)) }
                            } else null,
                            trailingIcon = {
                                IconButton(
                                    onClick = { menuTargetId = search.id },
                                    modifier = Modifier.size(18.dp)
                                ) {
                                    Icon(Icons.Default.MoreVert, contentDescription = "操作")
                                }
                            }
                        )
                        DropdownMenu(
                            expanded = menuTargetId == search.id,
                            onDismissRequest = { menuTargetId = null }
                        ) {
                            if (!search.isDefault) {
                                DropdownMenuItem(
                                    text = { Text("既定にする") },
                                    onClick = { menuTargetId = null; onSetDefault(search) }
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("削除") },
                                onClick = { menuTargetId = null; onDelete(search) }
                            )
                        }
                    }
                }
            }
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
    }

    if (showSaveDialog) {
        SaveSearchDialog(
            onConfirm = { name, isDefault ->
                onSaveCurrent(name, isDefault)
                showSaveDialog = false
            },
            onDismiss = { showSaveDialog = false }
        )
    }
}

@Composable
private fun SaveSearchDialog(
    onConfirm: (String, Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var isDefault by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("条件を保存") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("名前") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Checkbox(checked = isDefault, onCheckedChange = { isDefault = it })
                    Text("既定にする")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name, isDefault) },
                enabled = name.isNotBlank()
            ) { Text("保存") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("キャンセル") }
        }
    )
}
