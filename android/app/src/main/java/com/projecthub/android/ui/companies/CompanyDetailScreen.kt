package com.projecthub.android.ui.companies

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
import com.projecthub.android.data.api.models.ContactDto
import com.projecthub.android.data.api.models.LocationDto
import com.projecthub.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyDetailScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()

    LaunchedEffect(companyId) {
        viewModel.loadCompany(companyId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.company?.name ?: "会社詳細") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadCompany(companyId) }) {
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
                onRetry = { viewModel.loadCompany(companyId) }
            )
            uiState.company != null -> {
                CompanyDetailContent(
                    company = uiState.company!!,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@Composable
private fun CompanyDetailContent(
    company: CompanyDto,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
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
                        text = company.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    company.legalEntityStatus?.let {
                        Text(
                            text = it.name,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Basic Info
        item {
            SectionHeader("基本情報")
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(vertical = 8.dp)) {
                    val address = listOfNotNull(
                        company.postalCode?.let { "〒$it" },
                        company.prefecture,
                        company.city,
                        company.street,
                        company.building
                    ).joinToString(" ")
                    InfoRow("住所", address.ifBlank { null })
                    InfoRow("電話番号", company.phone)
                    InfoRow("Webサイト", company.website)
                }
            }
        }

        // Notes
        if (!company.notes.isNullOrBlank()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("メモ")
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Text(
                        text = company.notes,
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        // Locations
        val locations = company.locations ?: emptyList()
        if (locations.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("拠点 (${locations.size})")
            }
            items(locations) { location ->
                LocationCard(location = location)
            }
        }

        // Contacts
        val contacts = company.contacts ?: emptyList()
        if (contacts.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SectionHeader("担当者 (${contacts.size}人)")
            }
            items(contacts) { contact ->
                ContactCard(contact = contact)
            }
        }
    }
}

@Composable
private fun LocationCard(location: LocationDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.LocationOn,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = location.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            val address = listOfNotNull(
                location.postalCode?.let { "〒$it" },
                location.prefecture,
                location.city,
                location.street,
                location.building
            ).joinToString(" ")
            if (address.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = address,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 26.dp)
                )
            }
            location.phone?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 26.dp)
                )
            }
        }
    }
}

@Composable
private fun ContactCard(contact: ContactDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = contact.fullName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    val detail = listOfNotNull(contact.department, contact.position).joinToString(" / ")
                    if (detail.isNotBlank()) {
                        Text(
                            text = detail,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            contact.email?.let {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = 26.dp)
                ) {
                    Icon(
                        Icons.Default.Email,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            contact.phone?.let {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = 26.dp)
                ) {
                    Icon(
                        Icons.Default.Phone,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
