package com.projecthub.android.ui.companies

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.*
import com.projecthub.android.ui.components.*

private enum class CompanyDetailTab(val label: String) {
    HOME("概要"),
    CONTACTS("連絡先"),
    DEALS("商談"),
    ACTIVITIES("活動履歴"),
    WIKI("Wiki"),
    COMMENTS("コメント"),
    LOCATIONS("拠点")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyDetailScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToContactCreate: () -> Unit = {},
    onNavigateToDealCreate: () -> Unit = {},
    onNavigateToActivityCreate: () -> Unit = {},
    onNavigateToCommentCreate: () -> Unit = {},
    onNavigateToLocationCreate: () -> Unit = {},
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()
    var selectedTab by rememberSaveable { mutableStateOf(CompanyDetailTab.HOME) }

    LaunchedEffect(companyId) {
        viewModel.loadCompany(companyId)
        viewModel.loadContacts(companyId)
        viewModel.loadLocations(companyId)
        viewModel.loadDeals(companyId)
        viewModel.loadActivities(companyId)
        viewModel.loadCompanyWikiPages(companyId)
        viewModel.loadCompanyComments(companyId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.company?.name ?: "企業詳細") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        viewModel.loadCompany(companyId)
                        viewModel.loadContacts(companyId)
                        viewModel.loadLocations(companyId)
                        viewModel.loadDeals(companyId)
                        viewModel.loadActivities(companyId)
                        viewModel.loadCompanyWikiPages(companyId)
                        viewModel.loadCompanyComments(companyId)
                    }) {
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
                    contacts = uiState.contacts,
                    locations = uiState.locations,
                    deals = uiState.deals,
                    activities = uiState.activities,
                    wikiPages = uiState.wikiPages,
                    comments = uiState.comments,
                    selectedTab = selectedTab,
                    onTabSelected = { selectedTab = it },
                    onNavigateToContactCreate = onNavigateToContactCreate,
                    onNavigateToDealCreate = onNavigateToDealCreate,
                    onNavigateToActivityCreate = onNavigateToActivityCreate,
                    onNavigateToCommentCreate = onNavigateToCommentCreate,
                    onNavigateToLocationCreate = onNavigateToLocationCreate,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@Composable
private fun CompanyDetailContent(
    company: CompanyDto,
    contacts: List<ContactDto>,
    locations: List<LocationDto>,
    deals: List<DealDto>,
    activities: List<ActivityDto>,
    wikiPages: List<CompanyWikiPageDto>,
    comments: List<CompanyCommentDto>,
    selectedTab: CompanyDetailTab,
    onTabSelected: (CompanyDetailTab) -> Unit,
    onNavigateToContactCreate: () -> Unit = {},
    onNavigateToDealCreate: () -> Unit = {},
    onNavigateToActivityCreate: () -> Unit = {},
    onNavigateToCommentCreate: () -> Unit = {},
    onNavigateToLocationCreate: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val tabs = CompanyDetailTab.entries

    Column(modifier = modifier.fillMaxSize()) {
        // Company header
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
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

        // Tab row
        ScrollableTabRow(
            selectedTabIndex = tabs.indexOf(selectedTab),
            edgePadding = 0.dp
        ) {
            tabs.forEach { tab ->
                Tab(
                    selected = selectedTab == tab,
                    onClick = { onTabSelected(tab) },
                    text = { Text(tab.label) }
                )
            }
        }

        // Tab content with FAB area
        Box(modifier = Modifier.fillMaxSize()) {
            when (selectedTab) {
                CompanyDetailTab.HOME -> HomeTabContent(company)
                CompanyDetailTab.CONTACTS -> ContactsTabContent(contacts)
                CompanyDetailTab.DEALS -> DealsTabContent(deals)
                CompanyDetailTab.ACTIVITIES -> ActivitiesTabContent(activities)
                CompanyDetailTab.WIKI -> WikiTabContent(wikiPages)
                CompanyDetailTab.COMMENTS -> CommentsTabContent(comments)
                CompanyDetailTab.LOCATIONS -> LocationsTabContent(locations)
            }

            // FAB for tabs that support creation
            val showFab = selectedTab in listOf(
                CompanyDetailTab.CONTACTS,
                CompanyDetailTab.DEALS,
                CompanyDetailTab.ACTIVITIES,
                CompanyDetailTab.LOCATIONS,
                CompanyDetailTab.COMMENTS
            )
            if (showFab) {
                FloatingActionButton(
                    onClick = {
                        when (selectedTab) {
                            CompanyDetailTab.CONTACTS -> onNavigateToContactCreate()
                            CompanyDetailTab.DEALS -> onNavigateToDealCreate()
                            CompanyDetailTab.ACTIVITIES -> onNavigateToActivityCreate()
                            CompanyDetailTab.LOCATIONS -> onNavigateToLocationCreate()
                            CompanyDetailTab.COMMENTS -> onNavigateToCommentCreate()
                            else -> {}
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(16.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "新規追加")
                }
            }
        }
    }

}

// ==============================
// Tab content composables
// ==============================

@Composable
private fun HomeTabContent(company: CompanyDto) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
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
                    InfoRow("FAX", company.fax)
                    InfoRow("Webサイト", company.website)
                }
            }
        }

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
    }
}

@Composable
private fun ContactsTabContent(contacts: List<ContactDto>) {
    if (contacts.isEmpty()) {
        EmptyTabContent("連絡先が登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp, horizontal = 0.dp)
        ) {
            items(contacts) { contact ->
                ContactCard(contact = contact)
            }
        }
    }
}

@Composable
private fun DealsTabContent(deals: List<DealDto>) {
    if (deals.isEmpty()) {
        EmptyTabContent("商談が登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(deals) { deal ->
                DealCard(deal = deal)
            }
        }
    }
}

@Composable
private fun ActivitiesTabContent(activities: List<ActivityDto>) {
    if (activities.isEmpty()) {
        EmptyTabContent("活動履歴が登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(activities) { activity ->
                ActivityCard(activity = activity)
            }
        }
    }
}

@Composable
private fun LocationsTabContent(locations: List<LocationDto>) {
    if (locations.isEmpty()) {
        EmptyTabContent("拠点が登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp, horizontal = 0.dp)
        ) {
            items(locations) { location ->
                LocationCard(location = location)
            }
        }
    }
}

@Composable
private fun WikiTabContent(wikiPages: List<CompanyWikiPageDto>) {
    if (wikiPages.isEmpty()) {
        EmptyTabContent("Wiki ページが登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(wikiPages) { page ->
                WikiPageCard(page = page)
            }
        }
    }
}

@Composable
private fun WikiPageCard(page: CompanyWikiPageDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Article,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = page.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            page.updatedAt?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "更新: ${it.take(10)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 26.dp)
                )
            }
        }
    }
}

@Composable
private fun CommentsTabContent(comments: List<CompanyCommentDto>) {
    if (comments.isEmpty()) {
        EmptyTabContent("コメントが登録されていません")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(comments) { comment ->
                CommentCard(comment = comment)
            }
        }
    }
}

@Composable
private fun CommentCard(comment: CompanyCommentDto) {
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
                Text(
                    text = comment.author?.fullName ?: "不明",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                )
                comment.createdAt?.let {
                    Text(
                        text = it.take(10),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = comment.content,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun EmptyTabContent(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 72.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ==============================
// Card composables
// ==============================

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
                    Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            contact.phone?.let {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = 26.dp)
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun DealCard(deal: DealDto) {
    val statusLabel = when (deal.status) {
        "prospecting" -> "見込み"
        "qualification" -> "評価中"
        "proposal" -> "提案中"
        "negotiation" -> "交渉中"
        "closed_won" -> "成約"
        "closed_lost" -> "失注"
        else -> deal.status
    }
    val statusColor = when (deal.status) {
        "closed_won" -> MaterialTheme.colorScheme.tertiary
        "closed_lost" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.secondary
    }
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
                Text(
                    text = deal.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = statusColor.copy(alpha = 0.12f)
                ) {
                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }
            deal.amount?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "¥${String.format("%,.0f", it)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            deal.expectedCloseDate?.let {
                Text(
                    text = "見込み日: ${it.take(10)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ActivityCard(activity: ActivityDto) {
    val typeIcon = when (activity.type) {
        "call" -> Icons.Default.Phone
        "email" -> Icons.Default.Email
        "visit" -> Icons.Default.DirectionsWalk
        "meeting" -> Icons.Default.Groups
        else -> Icons.Default.Notes
    }
    val typeLabel = when (activity.type) {
        "call" -> "電話"
        "email" -> "メール"
        "visit" -> "訪問"
        "meeting" -> "会議"
        "note" -> "メモ"
        else -> activity.type
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                typeIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp).padding(top = 2.dp),
                tint = if (activity.completed) MaterialTheme.colorScheme.tertiary
                       else MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = activity.subject,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = typeLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                activity.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                }
                activity.dueDate?.let {
                    Text(
                        text = "期日: ${it.take(10)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

