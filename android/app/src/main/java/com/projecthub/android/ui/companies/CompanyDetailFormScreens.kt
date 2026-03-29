package com.projecthub.android.ui.companies

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.data.api.models.ContactDetailRequest
import com.projecthub.android.ui.components.DatePickerField
import com.projecthub.android.ui.constants.PREFECTURES
import com.projecthub.android.ui.utils.formatPostalCode


private data class ContactDetailState(
    val locationId: Int? = null,
    val department: String = "",
    val position: String = "",
    val phone: String = "",
    val email: String = "",
    val isPrimary: Boolean = false
)

// ==============================
// 連絡先登録
// ==============================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactCreateScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()

    LaunchedEffect(companyId) {
        if (uiState.locations.isEmpty()) viewModel.loadLocations(companyId)
    }

    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var details by remember { mutableStateOf(listOf(ContactDetailState(isPrimary = true))) }
    var firstNameError by remember { mutableStateOf(false) }
    var lastNameError by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("連絡先登録") },
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
                        ExposedDropdownMenuBox(
                            expanded = locationExpanded,
                            onExpandedChange = { locationExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = uiState.locations.find { it.id == detail.locationId }?.name ?: "拠点を選択",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("拠点") },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = locationExpanded) }
                            )
                            ExposedDropdownMenu(expanded = locationExpanded, onDismissRequest = { locationExpanded = false }) {
                                DropdownMenuItem(
                                    text = { Text("なし") },
                                    onClick = {
                                        details = details.toMutableList().also { it[index] = detail.copy(locationId = null) }
                                        locationExpanded = false
                                    }
                                )
                                uiState.locations.forEach { loc ->
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

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("備考") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )

            Spacer(modifier = Modifier.height(8.dp))

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
                    viewModel.createContact(
                        companyId = companyId,
                        firstName = firstName,
                        lastName = lastName,
                        notes = notes.ifBlank { null },
                        details = detailRequests,
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text("作成", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ==============================
// 商談登録
// ==============================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealCreateScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("商談登録") },
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
                label = { Text("商談名 *") },
                modifier = Modifier.fillMaxWidth(),
                isError = nameError,
                supportingText = if (nameError) { { Text("必須項目です") } } else null,
                singleLine = true
            )
            ExposedDropdownMenuBox(expanded = statusExpanded, onExpandedChange = { statusExpanded = it }) {
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
                        DropdownMenuItem(text = { Text(label) }, onClick = { selectedStatus = value; statusExpanded = false })
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
            DatePickerField(
                value = expectedCloseDate,
                onValueChange = { expectedCloseDate = it },
                label = "見込み日",
                modifier = Modifier.fillMaxWidth(),
                placeholder = "YYYY-MM-DD"
            )
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("メモ") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    viewModel.createDeal(
                        companyId = companyId,
                        name = name,
                        status = selectedStatus,
                        amount = amountText.toDoubleOrNull(),
                        probability = probabilityText.toIntOrNull(),
                        expectedCloseDate = expectedCloseDate.ifBlank { null },
                        notes = notes.ifBlank { null },
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text("作成", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ==============================
// 活動履歴登録
// ==============================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityCreateScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()

    LaunchedEffect(companyId) {
        if (uiState.contacts.isEmpty()) viewModel.loadContacts(companyId)
    }

    val activityTypes = listOf(
        "call" to "電話",
        "email" to "メール",
        "visit" to "訪問",
        "meeting" to "会議",
        "note" to "メモ"
    )
    var selectedType by remember { mutableStateOf("call") }
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedContactId by remember { mutableStateOf<Int?>(null) }
    var dueDate by remember { mutableStateOf("") }
    var typeExpanded by remember { mutableStateOf(false) }
    var contactExpanded by remember { mutableStateOf(false) }
    var subjectError by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("活動登録") },
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
            ExposedDropdownMenuBox(expanded = typeExpanded, onExpandedChange = { typeExpanded = it }) {
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
                        DropdownMenuItem(text = { Text(label) }, onClick = { selectedType = value; typeExpanded = false })
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
            if (uiState.contacts.isNotEmpty()) {
                ExposedDropdownMenuBox(expanded = contactExpanded, onExpandedChange = { contactExpanded = it }) {
                    OutlinedTextField(
                        value = uiState.contacts.find { it.id == selectedContactId }?.fullName ?: "なし",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("関連連絡先") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = contactExpanded) }
                    )
                    ExposedDropdownMenu(expanded = contactExpanded, onDismissRequest = { contactExpanded = false }) {
                        DropdownMenuItem(text = { Text("なし") }, onClick = { selectedContactId = null; contactExpanded = false })
                        uiState.contacts.forEach { contact ->
                            DropdownMenuItem(text = { Text(contact.fullName) }, onClick = { selectedContactId = contact.id; contactExpanded = false })
                        }
                    }
                }
            }
            DatePickerField(
                value = dueDate,
                onValueChange = { dueDate = it },
                label = "期日",
                modifier = Modifier.fillMaxWidth(),
                placeholder = "YYYY-MM-DD"
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (subject.isBlank()) { subjectError = true; return@Button }
                    viewModel.createActivity(
                        companyId = companyId,
                        type = selectedType,
                        subject = subject,
                        description = description.ifBlank { null },
                        contactId = selectedContactId,
                        dueDate = dueDate.ifBlank { null },
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text("作成", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ==============================
// コメント登録
// ==============================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyCommentCreateScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()
    var content by remember { mutableStateOf("") }
    var contentError by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("コメント追加") },
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
                value = content,
                onValueChange = { content = it; contentError = false },
                label = { Text("コメント *") },
                modifier = Modifier.fillMaxWidth(),
                isError = contentError,
                supportingText = if (contentError) { { Text("必須項目です") } } else null,
                minLines = 3,
                maxLines = 6
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (content.isBlank()) { contentError = true; return@Button }
                    viewModel.addCompanyComment(
                        companyId = companyId,
                        content = content,
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text("追加", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ==============================
// 拠点登録
// ==============================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationCreateScreen(
    companyId: Int,
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.detailUiState.collectAsState()
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var postalCode by remember { mutableStateOf("") }
    var prefecture by remember { mutableStateOf("") }
    var prefectureExpanded by remember { mutableStateOf(false) }
    var city by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var building by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("拠点登録") },
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
                label = { Text("拠点名 *") },
                modifier = Modifier.fillMaxWidth(),
                isError = nameError,
                supportingText = if (nameError) { { Text("必須項目です") } } else null,
                singleLine = true
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = postalCode,
                    onValueChange = { postalCode = formatPostalCode(it) },
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
                ExposedDropdownMenuBox(
                    expanded = prefectureExpanded,
                    onExpandedChange = { prefectureExpanded = it },
                    modifier = Modifier.weight(1f)
                ) {
                    OutlinedTextField(
                        value = prefecture,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("都道府県") },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = prefectureExpanded) }
                    )
                    ExposedDropdownMenu(
                        expanded = prefectureExpanded,
                        onDismissRequest = { prefectureExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("なし") },
                            onClick = { prefecture = ""; prefectureExpanded = false }
                        )
                        PREFECTURES.forEach { pref ->
                            DropdownMenuItem(
                                text = { Text(pref) },
                                onClick = { prefecture = pref; prefectureExpanded = false }
                            )
                        }
                    }
                }
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

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (name.isBlank()) { nameError = true; return@Button }
                    viewModel.createLocation(
                        companyId = companyId,
                        name = name,
                        phone = phone.ifBlank { null },
                        postalCode = postalCode.ifBlank { null },
                        prefecture = prefecture.ifBlank { null },
                        city = city.ifBlank { null },
                        street = street.ifBlank { null },
                        building = building.ifBlank { null },
                        notes = notes.ifBlank { null },
                        onSuccess = { onNavigateBack() },
                        onError = {}
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Text("作成", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
