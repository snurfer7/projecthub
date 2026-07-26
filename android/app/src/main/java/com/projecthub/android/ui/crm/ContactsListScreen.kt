package com.projecthub.android.ui.crm

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.ContactDto
import com.projecthub.android.ui.components.EmptyScreen
import com.projecthub.android.ui.components.ErrorScreen
import com.projecthub.android.ui.components.LoadingScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactsListScreen(
    onNavigateBack: () -> Unit,
    onNavigateToCompany: (Int, String) -> Unit,
    viewModel: ContactsListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    val shouldLoadMore by remember {
        derivedStateOf {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= uiState.items.size - 5
        }
    }
    LaunchedEffect(shouldLoadMore, uiState.items.size) {
        if (shouldLoadMore) viewModel.loadNextPage()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("連絡先") },
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
        ) {
            OutlinedTextField(
                value = uiState.query,
                onValueChange = { viewModel.setQuery(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("連絡先を検索...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "検索") },
                trailingIcon = {
                    if (uiState.query.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setQuery("") }) {
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
                    onRetry = { viewModel.refresh() }
                )
                uiState.items.isEmpty() -> EmptyScreen(
                    if (uiState.query.isNotBlank()) "検索結果がありません" else "連絡先がありません"
                )
                else -> {
                    Text(
                        text = "全${uiState.total}件",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(uiState.items, key = { it.id }) { contact ->
                            ContactListItem(
                                contact = contact,
                                onClick = { onNavigateToCompany(contact.companyId, "contacts") }
                            )
                        }
                        if (uiState.isLoadingMore) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
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
private fun ContactListItem(contact: ContactDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = contact.fullName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            contact.company?.let {
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
            val meta = listOfNotNull(contact.department, contact.position).joinToString(" / ")
            if (meta.isNotEmpty()) {
                Text(
                    text = meta,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                contact.phone?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall)
                }
                contact.email?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
