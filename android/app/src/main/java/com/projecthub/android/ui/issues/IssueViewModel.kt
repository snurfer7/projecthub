package com.projecthub.android.ui.issues

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.*
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class IssueListUiState(
    val isLoading: Boolean = false,
    val issues: List<IssueDto> = emptyList(),
    val metaOptions: IssueMetaOptions? = null,
    val selectedProjectId: Int? = null,
    val selectedStatusId: Int? = null,
    val selectedTrackerId: Int? = null,
    val selectedPriorityId: Int? = null,
    val error: String? = null
)

data class IssueDetailUiState(
    val isLoading: Boolean = false,
    val issue: IssueDto? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

data class IssueFormUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val metaOptions: IssueMetaOptions? = null,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val savedIssueId: Int? = null
)

@HiltViewModel
class IssueViewModel @Inject constructor(
    private val issueRepository: IssueRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(IssueListUiState())
    val listUiState: StateFlow<IssueListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow(IssueDetailUiState())
    val detailUiState: StateFlow<IssueDetailUiState> = _detailUiState.asStateFlow()

    private val _formUiState = MutableStateFlow(IssueFormUiState())
    val formUiState: StateFlow<IssueFormUiState> = _formUiState.asStateFlow()

    fun loadIssues(projectId: Int? = null) {
        val state = _listUiState.value
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = issueRepository.getIssues(
                projectId = projectId ?: state.selectedProjectId,
                statusId = state.selectedStatusId,
                trackerId = state.selectedTrackerId,
                priorityId = state.selectedPriorityId
            )) {
                is Result.Success -> {
                    _listUiState.update { it.copy(isLoading = false, issues = result.data) }
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun setProjectFilter(projectId: Int?) {
        _listUiState.update { it.copy(selectedProjectId = projectId) }
        loadIssues(projectId)
    }

    fun setStatusFilter(statusId: Int?) {
        _listUiState.update { it.copy(selectedStatusId = statusId) }
        loadIssuesWithCurrentFilters()
    }

    fun setTrackerFilter(trackerId: Int?) {
        _listUiState.update { it.copy(selectedTrackerId = trackerId) }
        loadIssuesWithCurrentFilters()
    }

    fun setPriorityFilter(priorityId: Int?) {
        _listUiState.update { it.copy(selectedPriorityId = priorityId) }
        loadIssuesWithCurrentFilters()
    }

    private fun loadIssuesWithCurrentFilters() {
        val state = _listUiState.value
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = issueRepository.getIssues(
                projectId = state.selectedProjectId,
                statusId = state.selectedStatusId,
                trackerId = state.selectedTrackerId,
                priorityId = state.selectedPriorityId
            )) {
                is Result.Success -> {
                    _listUiState.update { it.copy(isLoading = false, issues = result.data) }
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun loadMetaOptions(projectId: Int? = null) {
        viewModelScope.launch {
            when (val result = issueRepository.getMetaOptions(projectId)) {
                is Result.Success -> {
                    _listUiState.update { it.copy(metaOptions = result.data) }
                }
                else -> {}
            }
        }
    }

    fun loadIssue(id: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = issueRepository.getIssue(id)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isLoading = false, issue = result.data) }
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun updateIssueStatus(issueId: Int, statusId: Int) {
        viewModelScope.launch {
            val request = UpdateIssueRequest(
                statusId = statusId,
                trackerId = null, priorityId = null, assignedToId = null,
                assignedToGroupId = null, subject = null, description = null,
                startDate = null, dueDate = null, estimatedHours = null, doneRatio = null
            )
            when (val result = issueRepository.updateIssue(issueId, request)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(issue = result.data, successMessage = "ステータスを更新しました") }
                    // Refresh list
                    loadIssuesWithCurrentFilters()
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun addComment(issueId: Int, content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _detailUiState.update { it.copy(isSaving = true) }
            when (val result = issueRepository.addComment(issueId, content)) {
                is Result.Success -> {
                    // Reload the issue to get updated comments
                    loadIssue(issueId)
                    _detailUiState.update { it.copy(isSaving = false, successMessage = "コメントを追加しました") }
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isSaving = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun clearDetailMessages() {
        _detailUiState.update { it.copy(error = null, successMessage = null) }
    }

    // Form operations
    fun loadFormMetaOptions(projectId: Int? = null) {
        viewModelScope.launch {
            _formUiState.update { it.copy(isLoading = true) }
            when (val result = issueRepository.getMetaOptions(projectId)) {
                is Result.Success -> {
                    _formUiState.update { it.copy(isLoading = false, metaOptions = result.data) }
                }
                is Result.Error -> {
                    _formUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun createIssue(request: CreateIssueRequest) {
        viewModelScope.launch {
            _formUiState.update { it.copy(isSaving = true, error = null) }
            when (val result = issueRepository.createIssue(request)) {
                is Result.Success -> {
                    _formUiState.update { it.copy(isSaving = false, isSuccess = true, savedIssueId = result.data.id) }
                    loadIssuesWithCurrentFilters()
                }
                is Result.Error -> {
                    _formUiState.update { it.copy(isSaving = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun updateIssue(id: Int, request: UpdateIssueRequest) {
        viewModelScope.launch {
            _formUiState.update { it.copy(isSaving = true, error = null) }
            when (val result = issueRepository.updateIssue(id, request)) {
                is Result.Success -> {
                    _formUiState.update { it.copy(isSaving = false, isSuccess = true, savedIssueId = result.data.id) }
                    _detailUiState.update { it.copy(issue = result.data) }
                }
                is Result.Error -> {
                    _formUiState.update { it.copy(isSaving = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun resetFormState() {
        _formUiState.value = IssueFormUiState()
    }
}
