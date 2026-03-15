package com.projecthub.android.ui.timeentries

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.CreateTimeEntryRequest
import com.projecthub.android.data.api.models.TimeEntryDto
import com.projecthub.android.data.repository.Result
import com.projecthub.android.data.repository.TimeRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TimeEntriesUiState(
    val isLoading: Boolean = false,
    val entries: List<TimeEntryDto> = emptyList(),
    val totalHours: Double = 0.0,
    val error: String? = null
)

data class TimeEntryFormUiState(
    val isSaving: Boolean = false,
    val isSuccess: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class TimeEntriesViewModel @Inject constructor(
    private val timeRepository: TimeRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(TimeEntriesUiState())
    val listUiState: StateFlow<TimeEntriesUiState> = _listUiState.asStateFlow()

    private val _formUiState = MutableStateFlow(TimeEntryFormUiState())
    val formUiState: StateFlow<TimeEntryFormUiState> = _formUiState.asStateFlow()

    fun loadTimeEntries(projectId: Int? = null) {
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = timeRepository.getTimeEntries(projectId)) {
                is Result.Success -> {
                    val entries = result.data
                    val totalHours = entries.sumOf { it.hours }
                    _listUiState.update { it.copy(
                        isLoading = false,
                        entries = entries,
                        totalHours = totalHours
                    )}
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun createTimeEntry(request: CreateTimeEntryRequest) {
        viewModelScope.launch {
            _formUiState.update { it.copy(isSaving = true, error = null) }
            when (val result = timeRepository.createTimeEntry(request)) {
                is Result.Success -> {
                    _formUiState.update { it.copy(isSaving = false, isSuccess = true) }
                    loadTimeEntries()
                }
                is Result.Error -> {
                    _formUiState.update { it.copy(isSaving = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun deleteTimeEntry(id: Int) {
        viewModelScope.launch {
            when (timeRepository.deleteTimeEntry(id)) {
                is Result.Success -> loadTimeEntries()
                else -> {}
            }
        }
    }

    fun resetFormState() {
        _formUiState.value = TimeEntryFormUiState()
    }
}
