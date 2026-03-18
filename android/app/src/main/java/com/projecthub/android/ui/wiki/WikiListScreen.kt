package com.projecthub.android.ui.wiki

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
import com.projecthub.android.data.api.models.WikiPageDto
import com.projecthub.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WikiListScreen(
    projectId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToPage: (Int, Int) -> Unit,
    viewModel: WikiViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.loadWikiPages(projectId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wiki") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadWikiPages(projectId) }) {
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
                onRetry = { viewModel.loadWikiPages(projectId) }
            )
            uiState.pages.isEmpty() -> EmptyScreen("Wikiページがありません")
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    items(uiState.pages) { page ->
                        WikiPageListItem(
                            page = page,
                            onClick = { onNavigateToPage(projectId, page.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WikiPageListItem(
    page: WikiPageDto,
    onClick: () -> Unit,
    indentLevel: Int = 0
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = (16 + indentLevel * 16).dp,
                end = 16.dp,
                top = 4.dp,
                bottom = 4.dp
            )
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Article,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = page.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    page.author?.let {
                        Text(
                            text = it.fullName,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    page.updatedAt?.take(10)?.let {
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

    // Show children recursively
    page.children?.forEach { child ->
        WikiPageListItem(
            page = child,
            onClick = onClick,
            indentLevel = indentLevel + 1
        )
    }
}
