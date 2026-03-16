package com.projecthub.android.ui.companies

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.*
import com.projecthub.android.data.repository.CompanyRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CompanyListUiState(
    val isLoading: Boolean = false,
    val companies: List<CompanyDto> = emptyList(),
    val filteredCompanies: List<CompanyDto> = emptyList(),
    val searchQuery: String = "",
    val error: String? = null,
    val legalEntityStatuses: List<LegalEntityStatusDto> = emptyList(),
    val isCreating: Boolean = false,
    val createError: String? = null
)

data class CompanyDetailUiState(
    val isLoading: Boolean = false,
    val company: CompanyDto? = null,
    val error: String? = null,
    val contacts: List<ContactDto> = emptyList(),
    val isContactsLoading: Boolean = false,
    val locations: List<LocationDto> = emptyList(),
    val isLocationsLoading: Boolean = false,
    val deals: List<DealDto> = emptyList(),
    val isDealsLoading: Boolean = false,
    val activities: List<ActivityDto> = emptyList(),
    val isActivitiesLoading: Boolean = false,
    val wikiPages: List<CompanyWikiPageDto> = emptyList(),
    val isWikiLoading: Boolean = false,
    val comments: List<CompanyCommentDto> = emptyList(),
    val isCommentsLoading: Boolean = false,
    val isCreating: Boolean = false,
    val createError: String? = null
)

@HiltViewModel
class CompanyViewModel @Inject constructor(
    private val companyRepository: CompanyRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(CompanyListUiState())
    val listUiState: StateFlow<CompanyListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow(CompanyDetailUiState())
    val detailUiState: StateFlow<CompanyDetailUiState> = _detailUiState.asStateFlow()

    init {
        loadCompanies()
        loadLegalEntityStatuses()
    }

    fun loadCompanies() {
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = companyRepository.getCompanies()) {
                is Result.Success -> {
                    _listUiState.update { state ->
                        state.copy(
                            isLoading = false,
                            companies = result.data,
                            filteredCompanies = applySearch(result.data, state.searchQuery)
                        )
                    }
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    private fun loadLegalEntityStatuses() {
        viewModelScope.launch {
            when (val result = companyRepository.getLegalEntityStatuses()) {
                is Result.Success -> _listUiState.update { it.copy(legalEntityStatuses = result.data) }
                else -> {}
            }
        }
    }

    fun updateSearchQuery(query: String) {
        _listUiState.update { state ->
            state.copy(
                searchQuery = query,
                filteredCompanies = applySearch(state.companies, query)
            )
        }
    }

    private fun applySearch(companies: List<CompanyDto>, query: String): List<CompanyDto> {
        if (query.isBlank()) return companies
        return companies.filter { company ->
            company.name.contains(query, ignoreCase = true) ||
            company.city?.contains(query, ignoreCase = true) == true ||
            company.prefecture?.contains(query, ignoreCase = true) == true
        }
    }

    fun createCompany(
        name: String,
        phone: String?,
        postalCode: String?,
        prefecture: String?,
        city: String?,
        street: String?,
        building: String?,
        website: String?,
        notes: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _listUiState.update { it.copy(isCreating = true, createError = null) }
            val request = CreateCompanyRequest(
                name = name,
                phone = phone?.ifBlank { null },
                postalCode = postalCode?.ifBlank { null },
                prefecture = prefecture?.ifBlank { null },
                city = city?.ifBlank { null },
                street = street?.ifBlank { null },
                building = building?.ifBlank { null },
                website = website?.ifBlank { null },
                notes = notes?.ifBlank { null }
            )
            when (val result = companyRepository.createCompany(request)) {
                is Result.Success -> {
                    _listUiState.update { it.copy(isCreating = false) }
                    loadCompanies()
                    onSuccess()
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _listUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun clearListCreateError() {
        _listUiState.update { it.copy(createError = null) }
    }

    fun loadCompany(id: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = companyRepository.getCompany(id)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isLoading = false, company = result.data) }
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun loadDeals(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isDealsLoading = true) }
            when (val result = companyRepository.getDeals(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isDealsLoading = false, deals = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isDealsLoading = false) }
                else -> _detailUiState.update { it.copy(isDealsLoading = false) }
            }
        }
    }

    fun loadActivities(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isActivitiesLoading = true) }
            when (val result = companyRepository.getActivities(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isActivitiesLoading = false, activities = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isActivitiesLoading = false) }
                else -> _detailUiState.update { it.copy(isActivitiesLoading = false) }
            }
        }
    }

    fun loadContacts(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isContactsLoading = true) }
            when (val result = companyRepository.getContacts(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isContactsLoading = false, contacts = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isContactsLoading = false) }
                else -> _detailUiState.update { it.copy(isContactsLoading = false) }
            }
        }
    }

    fun loadLocations(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isLocationsLoading = true) }
            when (val result = companyRepository.getLocations(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isLocationsLoading = false, locations = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isLocationsLoading = false) }
                else -> _detailUiState.update { it.copy(isLocationsLoading = false) }
            }
        }
    }

    fun loadCompanyWikiPages(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isWikiLoading = true) }
            when (val result = companyRepository.getCompanyWikiPages(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isWikiLoading = false, wikiPages = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isWikiLoading = false) }
                else -> _detailUiState.update { it.copy(isWikiLoading = false) }
            }
        }
    }

    fun loadCompanyComments(companyId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCommentsLoading = true) }
            when (val result = companyRepository.getCompanyComments(companyId)) {
                is Result.Success -> _detailUiState.update { it.copy(isCommentsLoading = false, comments = result.data) }
                is Result.Error -> _detailUiState.update { it.copy(isCommentsLoading = false) }
                else -> _detailUiState.update { it.copy(isCommentsLoading = false) }
            }
        }
    }

    fun addCompanyComment(
        companyId: Int,
        content: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCreating = true, createError = null) }
            when (val result = companyRepository.addCompanyComment(companyId, content)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isCreating = false) }
                    loadCompanyComments(companyId)
                    onSuccess()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _detailUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun createContact(
        companyId: Int,
        firstName: String,
        lastName: String,
        notes: String?,
        details: List<ContactDetailRequest>,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCreating = true, createError = null) }
            val request = CreateContactRequest(
                firstName = firstName,
                lastName = lastName,
                companyId = companyId,
                notes = notes?.ifBlank { null },
                details = details
            )
            when (val result = companyRepository.createContact(request)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isCreating = false) }
                    loadContacts(companyId)
                    onSuccess()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _detailUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun createDeal(
        companyId: Int,
        name: String,
        status: String,
        amount: Double?,
        probability: Int?,
        expectedCloseDate: String?,
        notes: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCreating = true, createError = null) }
            val request = CreateDealRequest(
                name = name,
                companyId = companyId,
                amount = amount,
                status = status,
                probability = probability,
                expectedCloseDate = expectedCloseDate?.ifBlank { null },
                notes = notes?.ifBlank { null }
            )
            when (val result = companyRepository.createDeal(request)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isCreating = false) }
                    loadDeals(companyId)
                    onSuccess()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _detailUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun createActivity(
        companyId: Int,
        type: String,
        subject: String,
        description: String?,
        contactId: Int?,
        dueDate: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCreating = true, createError = null) }
            val request = CreateActivityRequest(
                companyId = companyId,
                type = type,
                subject = subject,
                description = description?.ifBlank { null },
                contactId = contactId,
                dueDate = dueDate?.ifBlank { null }
            )
            when (val result = companyRepository.createActivity(request)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isCreating = false) }
                    loadActivities(companyId)
                    onSuccess()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _detailUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun createLocation(
        companyId: Int,
        name: String,
        phone: String?,
        postalCode: String?,
        prefecture: String?,
        city: String?,
        street: String?,
        building: String?,
        notes: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isCreating = true, createError = null) }
            val request = CreateLocationRequest(
                name = name,
                phone = phone?.ifBlank { null },
                postalCode = postalCode?.ifBlank { null },
                prefecture = prefecture?.ifBlank { null },
                city = city?.ifBlank { null },
                street = street?.ifBlank { null },
                building = building?.ifBlank { null },
                notes = notes?.ifBlank { null }
            )
            when (val result = companyRepository.createLocation(companyId, request)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isCreating = false) }
                    loadLocations(companyId)
                    onSuccess()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isCreating = false, createError = result.message) }
                    onError(result.message)
                }
                else -> _detailUiState.update { it.copy(isCreating = false) }
            }
        }
    }

    fun clearDetailCreateError() {
        _detailUiState.update { it.copy(createError = null) }
    }
}
