package com.projecthub.android.ui.companies

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
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()

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
                    companyId = companyId,
                    company = uiState.company!!,
                    contacts = uiState.contacts,
                    locations = uiState.locations,
                    deals = uiState.deals,
                    activities = uiState.activities,
                    wikiPages = uiState.wikiPages,
                    comments = uiState.comments,
                    isCreating = uiState.isCreating,
                    viewModel = viewModel,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

@Composable
private fun CompanyDetailContent(
    companyId: Int,
    company: CompanyDto,
    contacts: List<ContactDto>,
    locations: List<LocationDto>,
    deals: List<DealDto>,
    activities: List<ActivityDto>,
    wikiPages: List<CompanyWikiPageDto>,
    comments: List<CompanyCommentDto>,
    isCreating: Boolean,
    viewModel: CompanyViewModel,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(CompanyDetailTab.HOME) }
    val tabs = CompanyDetailTab.entries

    // Dialog visibility state
    var showContactDialog by remember { mutableStateOf(false) }
    var showDealDialog by remember { mutableStateOf(false) }
    var showActivityDialog by remember { mutableStateOf(false) }
    var showLocationDialog by remember { mutableStateOf(false) }
    var showCommentDialog by remember { mutableStateOf(false) }

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
                    onClick = { selectedTab = tab },
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
                            CompanyDetailTab.CONTACTS -> showContactDialog = true
                            CompanyDetailTab.DEALS -> showDealDialog = true
                            CompanyDetailTab.ACTIVITIES -> showActivityDialog = true
                            CompanyDetailTab.LOCATIONS -> showLocationDialog = true
                            CompanyDetailTab.COMMENTS -> showCommentDialog = true
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

    // Dialogs
    if (showContactDialog) {
        ContactCreateDialog(
            locations = locations,
            isCreating = isCreating,
            onDismiss = { showContactDialog = false },
            onSubmit = { firstName, lastName, notes, details ->
                viewModel.createContact(
                    companyId = companyId,
                    firstName = firstName,
                    lastName = lastName,
                    notes = notes,
                    details = details,
                    onSuccess = { showContactDialog = false },
                    onError = {}
                )
            }
        )
    }

    if (showDealDialog) {
        DealCreateDialog(
            isCreating = isCreating,
            onDismiss = { showDealDialog = false },
            onSubmit = { name, status, amount, probability, expectedCloseDate, notes ->
                viewModel.createDeal(
                    companyId = companyId,
                    name = name,
                    status = status,
                    amount = amount,
                    probability = probability,
                    expectedCloseDate = expectedCloseDate,
                    notes = notes,
                    onSuccess = { showDealDialog = false },
                    onError = {}
                )
            }
        )
    }

    if (showActivityDialog) {
        ActivityCreateDialog(
            contacts = contacts,
            isCreating = isCreating,
            onDismiss = { showActivityDialog = false },
            onSubmit = { type, subject, description, contactId, dueDate ->
                viewModel.createActivity(
                    companyId = companyId,
                    type = type,
                    subject = subject,
                    description = description,
                    contactId = contactId,
                    dueDate = dueDate,
                    onSuccess = { showActivityDialog = false },
                    onError = {}
                )
            }
        )
    }

    if (showCommentDialog) {
        CommentCreateDialog(
            isCreating = isCreating,
            onDismiss = { showCommentDialog = false },
            onSubmit = { content ->
                viewModel.addCompanyComment(
                    companyId = companyId,
                    content = content,
                    onSuccess = { showCommentDialog = false },
                    onError = {}
                )
            }
        )
    }

    if (showLocationDialog) {
        LocationCreateDialog(
            isCreating = isCreating,
            onDismiss = { showLocationDialog = false },
            onSubmit = { name, phone, postalCode, prefecture, city, street, building, notes ->
                viewModel.createLocation(
                    companyId = companyId,
                    name = name,
                    phone = phone,
                    postalCode = postalCode,
                    prefecture = prefecture,
                    city = city,
                    street = street,
                    building = building,
                    notes = notes,
                    onSuccess = { showLocationDialog = false },
                    onError = {}
                )
            }
        )
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
        "meeting" -> Icons.Default.Groups
        "email" -> Icons.Default.Email
        "task" -> Icons.Default.CheckCircle
        else -> Icons.Default.Notes
    }
    val typeLabel = when (activity.type) {
        "call" -> "電話"
        "meeting" -> "会議"
        "email" -> "メール"
        "task" -> "タスク"
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

// ==============================
// Create Dialog composables
// ==============================

private data class ContactDetailState(
    val locationId: Int? = null,
    val department: String = "",
    val position: String = "",
    val phone: String = "",
    val email: String = "",
    val isPrimary: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactCreateDialog(
    locations: List<LocationDto>,
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (firstName: String, lastName: String, notes: String?, details: List<ContactDetailRequest>) -> Unit
) {
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var details by remember { mutableStateOf(listOf(ContactDetailState())) }
    var firstNameError by remember { mutableStateOf(false) }
    var lastNameError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("連絡先登録") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 姓・名
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = lastName,
                        onValueChange = { lastName = it; lastNameError = false },
                        label = { Text("姓 *") },
                        modifier = Modifier.weight(1f),
                        isError = lastNameError,
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = firstName,
                        onValueChange = { firstName = it; firstNameError = false },
                        label = { Text("名 *") },
                        modifier = Modifier.weight(1f),
                        isError = firstNameError,
                        singleLine = true
                    )
                }

                // 連絡先詳細セクション
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "連絡先詳細 (複数設定可)",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(
                        onClick = { details = details + ContactDetailState() },
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(2.dp))
                        Text("追加", style = MaterialTheme.typography.labelMedium)
                    }
                }

                details.forEachIndexed { index, detail ->
                    var locationExpanded by remember { mutableStateOf(false) }
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // 拠点コンボボックス
                            ExposedDropdownMenuBox(
                                expanded = locationExpanded,
                                onExpandedChange = { locationExpanded = it }
                            ) {
                                OutlinedTextField(
                                    value = locations.find { it.id == detail.locationId }?.name ?: "拠点を選択",
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("拠点") },
                                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = locationExpanded) }
                                )
                                ExposedDropdownMenu(
                                    expanded = locationExpanded,
                                    onDismissRequest = { locationExpanded = false }
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("なし") },
                                        onClick = {
                                            details = details.toMutableList().also { it[index] = detail.copy(locationId = null) }
                                            locationExpanded = false
                                        }
                                    )
                                    locations.forEach { loc ->
                                        DropdownMenuItem(
                                            text = { Text(loc.name) },
                                            onClick = {
                                                details = details.toMutableList().also { it[index] = detail.copy(locationId = loc.id) }
                                                locationExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                            // 所属・役職
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = detail.department,
                                    onValueChange = { v -> details = details.toMutableList().also { it[index] = detail.copy(department = v) } },
                                    label = { Text("所属") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true,
                                    placeholder = { Text("例: 営業部") }
                                )
                                OutlinedTextField(
                                    value = detail.position,
                                    onValueChange = { v -> details = details.toMutableList().also { it[index] = detail.copy(position = v) } },
                                    label = { Text("役職") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true,
                                    placeholder = { Text("例: 部長") }
                                )
                            }
                            // 電話・メール
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = detail.phone,
                                    onValueChange = { v -> details = details.toMutableList().also { it[index] = detail.copy(phone = v) } },
                                    label = { Text("電話") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = detail.email,
                                    onValueChange = { v -> details = details.toMutableList().also { it[index] = detail.copy(email = v) } },
                                    label = { Text("メール") },
                                    modifier = Modifier.weight(1f),
                                    singleLine = true
                                )
                            }
                            // 代表連絡先・削除
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = detail.isPrimary,
                                        onCheckedChange = { v -> details = details.toMutableList().also { it[index] = detail.copy(isPrimary = v) } },
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("代表連絡先として表示", style = MaterialTheme.typography.labelSmall)
                                }
                                if (details.size > 1) {
                                    TextButton(
                                        onClick = { details = details.filterIndexed { i, _ -> i != index } },
                                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)
                                    ) {
                                        Text("削除", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }

                // 備考
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("備考") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (lastName.isBlank()) { lastNameError = true; return@Button }
                    if (firstName.isBlank()) { firstNameError = true; return@Button }
                    val detailRequests = details
                        .filter { it.department.isNotBlank() || it.position.isNotBlank() || it.phone.isNotBlank() || it.email.isNotBlank() || it.locationId != null }
                        .map { d ->
                            ContactDetailRequest(
                                department = d.department.ifBlank { null },
                                position = d.position.ifBlank { null },
                                phone = d.phone.ifBlank { null },
                                email = d.email.ifBlank { null },
                                locationId = d.locationId,
                                isPrimary = d.isPrimary
                            )
                        }
                    onSubmit(firstName, lastName, notes.ifBlank { null }, detailRequests)
                },
                enabled = !isCreating
            ) {
                if (isCreating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("作成")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル") } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DealCreateDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (name: String, status: String, amount: Double?, probability: Int?, expectedCloseDate: String?, notes: String?) -> Unit
) {
    val dealStatuses = listOf(
        "prospecting" to "見込み",
        "qualification" to "評価中",
        "proposal" to "提案中",
        "negotiation" to "交渉中",
        "closed_won" to "成約",
        "closed_lost" to "失注"
    )
    var name by remember { mutableStateOf("") }
    var selectedStatus by remember { mutableStateOf("prospecting") }
    var amountText by remember { mutableStateOf("") }
    var probabilityText by remember { mutableStateOf("") }
    var expectedCloseDate by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var statusExpanded by remember { mutableStateOf(false) }
    var nameError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("商談登録") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; nameError = false },
                    label = { Text("商談名 *") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = nameError,
                    supportingText = if (nameError) { { Text("必須項目です") } } else null,
                    singleLine = true
                )
                ExposedDropdownMenuBox(
                    expanded = statusExpanded,
                    onExpandedChange = { statusExpanded = it }
                ) {
                    OutlinedTextField(
                        value = dealStatuses.find { it.first == selectedStatus }?.second ?: selectedStatus,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("ステータス") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusExpanded) }
                    )
                    ExposedDropdownMenu(expanded = statusExpanded, onDismissRequest = { statusExpanded = false }) {
                        dealStatuses.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { selectedStatus = value; statusExpanded = false }
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amountText = it },
                        label = { Text("金額") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("例: 1000000") }
                    )
                    OutlinedTextField(
                        value = probabilityText,
                        onValueChange = { probabilityText = it },
                        label = { Text("確度(%)") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("0-100") }
                    )
                }
                OutlinedTextField(
                    value = expectedCloseDate,
                    onValueChange = { expectedCloseDate = it },
                    label = { Text("見込み日") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("YYYY-MM-DD") }
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("メモ") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    val amount = amountText.toDoubleOrNull()
                    val probability = probabilityText.toIntOrNull()
                    onSubmit(name, selectedStatus, amount, probability, expectedCloseDate.ifBlank { null }, notes.ifBlank { null })
                },
                enabled = !isCreating
            ) {
                if (isCreating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("作成")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル") } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActivityCreateDialog(
    contacts: List<ContactDto>,
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (type: String, subject: String, description: String?, contactId: Int?, dueDate: String?) -> Unit
) {
    val activityTypes = listOf(
        "call" to "電話",
        "meeting" to "会議",
        "email" to "メール",
        "note" to "メモ",
        "task" to "タスク"
    )
    var selectedType by remember { mutableStateOf("call") }
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedContactId by remember { mutableStateOf<Int?>(null) }
    var dueDate by remember { mutableStateOf("") }
    var typeExpanded by remember { mutableStateOf(false) }
    var contactExpanded by remember { mutableStateOf(false) }
    var subjectError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("活動登録") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ExposedDropdownMenuBox(
                    expanded = typeExpanded,
                    onExpandedChange = { typeExpanded = it }
                ) {
                    OutlinedTextField(
                        value = activityTypes.find { it.first == selectedType }?.second ?: selectedType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("種別") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeExpanded) }
                    )
                    ExposedDropdownMenu(expanded = typeExpanded, onDismissRequest = { typeExpanded = false }) {
                        activityTypes.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { selectedType = value; typeExpanded = false }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it; subjectError = false },
                    label = { Text("件名 *") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = subjectError,
                    supportingText = if (subjectError) { { Text("必須項目です") } } else null,
                    singleLine = true
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("内容") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )
                if (contacts.isNotEmpty()) {
                    ExposedDropdownMenuBox(
                        expanded = contactExpanded,
                        onExpandedChange = { contactExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = contacts.find { it.id == selectedContactId }?.fullName ?: "なし",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("関連連絡先") },
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = contactExpanded) }
                        )
                        ExposedDropdownMenu(expanded = contactExpanded, onDismissRequest = { contactExpanded = false }) {
                            DropdownMenuItem(
                                text = { Text("なし") },
                                onClick = { selectedContactId = null; contactExpanded = false }
                            )
                            contacts.forEach { contact ->
                                DropdownMenuItem(
                                    text = { Text(contact.fullName) },
                                    onClick = { selectedContactId = contact.id; contactExpanded = false }
                                )
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = dueDate,
                    onValueChange = { dueDate = it },
                    label = { Text("期日") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("YYYY-MM-DD") }
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (subject.isBlank()) { subjectError = true; return@Button }
                    onSubmit(selectedType, subject, description.ifBlank { null }, selectedContactId, dueDate.ifBlank { null })
                },
                enabled = !isCreating
            ) {
                if (isCreating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("作成")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル") } }
    )
}

@Composable
private fun LocationCreateDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (name: String, phone: String?, postalCode: String?, prefecture: String?, city: String?, street: String?, building: String?, notes: String?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var postalCode by remember { mutableStateOf("") }
    var prefecture by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var building by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("拠点登録") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; nameError = false },
                    label = { Text("拠点名 *") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = nameError,
                    supportingText = if (nameError) { { Text("必須項目です") } } else null,
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = postalCode,
                        onValueChange = { postalCode = it },
                        label = { Text("郵便番号") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("000-0000") }
                    )
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("電話番号") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = prefecture,
                        onValueChange = { prefecture = it },
                        label = { Text("都道府県") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = city,
                        onValueChange = { city = it },
                        label = { Text("市区町村") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }
                OutlinedTextField(
                    value = street,
                    onValueChange = { street = it },
                    label = { Text("町域・番地") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = building,
                    onValueChange = { building = it },
                    label = { Text("建物名・部屋番号") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("備考") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 4
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    onSubmit(name, phone.ifBlank { null }, postalCode.ifBlank { null }, prefecture.ifBlank { null }, city.ifBlank { null }, street.ifBlank { null }, building.ifBlank { null }, notes.ifBlank { null })
                },
                enabled = !isCreating
            ) {
                if (isCreating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("作成")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル") } }
    )
}

@Composable
private fun CommentCreateDialog(
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (content: String) -> Unit
) {
    var content by remember { mutableStateOf("") }
    var contentError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("コメント追加") },
        text = {
            OutlinedTextField(
                value = content,
                onValueChange = { content = it; contentError = false },
                label = { Text("コメント *") },
                modifier = Modifier.fillMaxWidth(),
                isError = contentError,
                supportingText = if (contentError) { { Text("必須項目です") } } else null,
                minLines = 3,
                maxLines = 6
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    if (content.isBlank()) { contentError = true; return@Button }
                    onSubmit(content)
                },
                enabled = !isCreating
            ) {
                if (isCreating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("追加")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("キャンセル") } }
    )
}
