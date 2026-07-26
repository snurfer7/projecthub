package com.projecthub.android.ui.crm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.DealDto
import com.projecthub.android.data.repository.CompanyRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DealsListUiState(
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val items: List<DealDto> = emptyList(),
    val query: String = "",
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    val error: String? = null
)

@HiltViewModel
class DealsListViewModel @Inject constructor(
    private val companyRepository: CompanyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DealsListUiState())
    val uiState: StateFlow<DealsListUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        refresh()
    }

    fun setQuery(query: String) {
        _uiState.update { it.copy(query = query) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            fetch(page = 1, reset = true)
        }
    }

    fun refresh() {
        fetch(page = 1, reset = true)
    }

    fun loadNextPage() {
        val state = _uiState.value
        if (state.isLoadingMore || state.isLoading || state.page >= state.totalPages) return
        fetch(page = state.page + 1, reset = false)
    }

    private fun fetch(page: Int, reset: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = reset, isLoadingMore = !reset, error = null) }
            when (val result = companyRepository.getDealsPaged(page = page, q = _uiState.value.query)) {
                is Result.Success -> {
                    val data = result.data
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isLoadingMore = false,
                            items = if (reset) data.items else it.items + data.items,
                            page = data.page,
                            totalPages = data.totalPages,
                            total = data.total
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, isLoadingMore = false, error = result.message) }
                }
                else -> {}
            }
        }
    }
}
