package com.projecthub.android.ui.companies

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.CompanyDto
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
    val error: String? = null
)

data class CompanyDetailUiState(
    val isLoading: Boolean = false,
    val company: CompanyDto? = null,
    val error: String? = null
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
}
