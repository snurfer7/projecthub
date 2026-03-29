package com.projecthub.android.ui.companies

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.ui.constants.PREFECTURES
import com.projecthub.android.ui.utils.formatPostalCode


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyCreateScreen(
    onNavigateBack: () -> Unit,
    viewModel: CompanyViewModel = hiltViewModel()
) {
    val uiState by viewModel.listUiState.collectAsState()

    var name by remember { mutableStateOf("") }
    var selectedLegalEntityStatus by remember { mutableStateOf<com.projecthub.android.data.api.models.LegalEntityStatusDto?>(null) }
    var legalEntityPosition by remember { mutableStateOf("before") }
    var phone by remember { mutableStateOf("") }
    var fax by remember { mutableStateOf("") }
    var postalCode by remember { mutableStateOf("") }
    var prefecture by remember { mutableStateOf("") }
    var prefectureExpanded by remember { mutableStateOf(false) }
    var city by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var building by remember { mutableStateOf("") }
    var website by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf(false) }
    var legalEntityStatusExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("企業登録") },
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
                label = { Text("企業名 *") },
                modifier = Modifier.fillMaxWidth(),
                isError = nameError,
                supportingText = if (nameError) { { Text("必須項目です") } } else null,
                singleLine = true
            )
            if (uiState.legalEntityStatuses.isNotEmpty()) {
                ExposedDropdownMenuBox(
                    expanded = legalEntityStatusExpanded,
                    onExpandedChange = { legalEntityStatusExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedLegalEntityStatus?.name ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("法人格") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = legalEntityStatusExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = legalEntityStatusExpanded,
                        onDismissRequest = { legalEntityStatusExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("なし") },
                            onClick = { selectedLegalEntityStatus = null; legalEntityStatusExpanded = false }
                        )
                        uiState.legalEntityStatuses.forEach { status ->
                            DropdownMenuItem(
                                text = { Text(status.name) },
                                onClick = { selectedLegalEntityStatus = status; legalEntityStatusExpanded = false }
                            )
                        }
                    }
                }
                if (selectedLegalEntityStatus != null) {
                    Text(
                        text = "法人格の位置",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FilterChip(
                            selected = legalEntityPosition == "before",
                            onClick = { legalEntityPosition = "before" },
                            label = { Text("前（例：株式会社〇〇）") }
                        )
                        FilterChip(
                            selected = legalEntityPosition == "after",
                            onClick = { legalEntityPosition = "after" },
                            label = { Text("後（例：〇〇株式会社）") }
                        )
                    }
                }
            }
            OutlinedTextField(
                value = postalCode,
                onValueChange = { postalCode = formatPostalCode(it) },
                label = { Text("郵便番号") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("000-0000") }
            )

            ExposedDropdownMenuBox(
                expanded = prefectureExpanded,
                onExpandedChange = { prefectureExpanded = it }
            ) {
                OutlinedTextField(
                    value = prefecture,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("都道府県") },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                    placeholder = { Text("東京都") },
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
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
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
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("電話番号") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = fax,
                    onValueChange = { fax = it },
                    label = { Text("FAX") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }
            OutlinedTextField(
                value = website,
                onValueChange = { website = it },
                label = { Text("Webサイト") },
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
                    viewModel.createCompany(
                        name = name,
                        legalEntityStatusId = selectedLegalEntityStatus?.id,
                        legalEntityPosition = if (selectedLegalEntityStatus != null) legalEntityPosition else null,
                        phone = phone.ifBlank { null },
                        fax = fax.ifBlank { null },
                        postalCode = postalCode.ifBlank { null },
                        prefecture = prefecture.ifBlank { null },
                        city = city.ifBlank { null },
                        street = street.ifBlank { null },
                        building = building.ifBlank { null },
                        website = website.ifBlank { null },
                        notes = notes.ifBlank { null },
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
