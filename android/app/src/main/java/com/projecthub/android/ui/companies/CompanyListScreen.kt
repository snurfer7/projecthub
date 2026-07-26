package com.projecthub.android.ui.companies

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
import com.projecthub.android.data.api.models.CompanyDto
import com.projecthub.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyListScreen(
    onNavigateToCompany: (Int) -> Unit,
    onNavigateToCreate: () -> Unit = {},
    onNavigateToBusinessCardScan: () -> Unit = {},
    onNavigateToContacts: () -> Unit = {},
    onNavigateToDeals: () -> Unit = {},
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()
    var showMenu by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("企業") },
                actions = {
                    IconButton(onClick = { viewModel.loadCompanies() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "その他")
                        }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            DropdownMenuItem(
                                text = { Text("連絡先一覧") },
                                onClick = { showMenu = false; onNavigateToContacts() }
                            )
                            DropdownMenuItem(
                                text = { Text("商談一覧") },
                                onClick = { showMenu = false; onNavigateToDeals() }
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreate) {
                Icon(Icons.Default.Add, contentDescription = "新規企業")
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    placeholder = { Text("企業を検索...") },
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
                        onRetry = { viewModel.loadCompanies() }
                    )
                    uiState.filteredCompanies.isEmpty() -> EmptyScreen(
                        if (uiState.searchQuery.isNotBlank()) "検索結果がありません" else "企業がありません"
                    )
                    else -> {
                        LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                            items(uiState.filteredCompanies) { company ->
                                CompanyListItem(
                                    company = company,
                                    onClick = { onNavigateToCompany(company.id) }
                                )
                            }
                        }
                    }
                }
            }

            // 名刺スキャン FAB（左下・企業追加ボタンと同じ高さ）
            FloatingActionButton(
                onClick = onNavigateToBusinessCardScan,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 16.dp, bottom = 16.dp),
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            ) {
                Icon(Icons.Default.DocumentScanner, contentDescription = "名刺スキャン")
            }
        }
    }
}

@Composable
private fun CompanyListItem(
    company: CompanyDto,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(40.dp),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = company.name.take(1),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = company.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                val location = listOfNotNull(company.prefecture, company.city).joinToString(" ")
                if (location.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = location,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                company.phone?.let {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Phone,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
