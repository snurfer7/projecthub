package com.projecthub.android.ui.issues

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.*
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.Result
import com.projecthub.android.data.repository.SavedSearchRepository
import com.projecthub.android.ui.utils.IssueFilterCriteria
import com.projecthub.android.ui.utils.collectDescendantIds
import com.projecthub.android.ui.utils.filterIssues
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class IssueListUiState(
    val isLoading: Boolean = false,
    val allIssues: List<IssueDto> = emptyList(),
    val issues: List<IssueDto> = emptyList(),
    val metaOptions: IssueMetaOptions? = null,
    val selectedProjectId: Int? = null,
    val criteria: IssueFilterCriteria = IssueFilterCriteria(),
    val error: String? = null,
    val collapsedIssueIds: Set<Int> = emptySet(),
    val savedSearches: List<SavedSearchDto> = emptyList(),
    val hasAppliedDefaultSavedSearch: Boolean = false
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
    val savedIssueId: Int? = null,
    val parentCandidates: List<IssueDto> = emptyList()
)

@HiltViewModel
class IssueViewModel @Inject constructor(
    private val issueRepository: IssueRepository,
    private val savedSearchRepository: SavedSearchRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(IssueListUiState())
    val listUiState: StateFlow<IssueListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow(IssueDetailUiState())
    val detailUiState: StateFlow<IssueDetailUiState> = _detailUiState.asStateFlow()

    private val _formUiState = MutableStateFlow(IssueFormUiState())
    val formUiState: StateFlow<IssueFormUiState> = _formUiState.asStateFlow()

    fun loadIssues(projectId: Int? = null) {
        val state = _listUiState.value
        val effProjectId = projectId ?: state.selectedProjectId
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null, selectedProjectId = effProjectId) }
            when (val result = issueRepository.getIssues(projectId = effProjectId)) {
                is Result.Success -> {
                    _listUiState.update {
                        it.copy(isLoading = false, allIssues = result.data, issues = filterIssues(result.data, it.criteria, it.metaOptions))
                    }
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun toggleIssueCollapsed(id: Int) {
        _listUiState.update { state ->
            val collapsed = state.collapsedIssueIds
            state.copy(collapsedIssueIds = if (id in collapsed) collapsed - id else collapsed + id)
        }
    }

    fun setProjectFilter(projectId: Int?) {
        loadIssues(projectId)
    }

    fun setCriteria(criteria: IssueFilterCriteria) {
        _listUiState.update {
            it.copy(criteria = criteria, issues = filterIssues(it.allIssues, criteria, it.metaOptions))
        }
    }

    fun loadSavedSearches() {
        viewModelScope.launch {
            when (val result = savedSearchRepository.getSavedSearches(SAVED_SEARCH_VIEW_MODE_LIST)) {
                is Result.Success -> {
                    val searches = result.data.androidOnly()
                    _listUiState.update { it.copy(savedSearches = searches) }
                    if (!_listUiState.value.hasAppliedDefaultSavedSearch) {
                        searches.find { it.isDefault }?.filter?.toIssueFilterCriteriaOrNull()?.let { criteria ->
                            setCriteria(criteria)
                        }
                        _listUiState.update { it.copy(hasAppliedDefaultSavedSearch = true) }
                    }
                }
                else -> {}
            }
        }
    }

    fun saveCurrentSearch(name: String, isDefault: Boolean) {
        viewModelScope.launch {
            val request = CreateSavedSearchRequest(
                viewMode = SAVED_SEARCH_VIEW_MODE_LIST,
                name = name,
                filter = _listUiState.value.criteria.toFilterJson(),
                isDefault = isDefault
            )
            when (savedSearchRepository.createSavedSearch(request)) {
                is Result.Success -> loadSavedSearches()
                else -> {}
            }
        }
    }

    fun setSavedSearchDefault(search: SavedSearchDto) {
        viewModelScope.launch {
            when (savedSearchRepository.updateSavedSearch(search.id, UpdateSavedSearchRequest(isDefault = true))) {
                is Result.Success -> loadSavedSearches()
                else -> {}
            }
        }
    }

    fun deleteSavedSearch(search: SavedSearchDto) {
        viewModelScope.launch {
            when (savedSearchRepository.deleteSavedSearch(search.id)) {
                is Result.Success -> loadSavedSearches()
                else -> {}
            }
        }
    }

    fun loadMetaOptions(projectId: Int? = null) {
        viewModelScope.launch {
            when (val result = issueRepository.getMetaOptions(projectId)) {
                is Result.Success -> {
                    _listUiState.update {
                        it.copy(metaOptions = result.data, issues = filterIssues(it.allIssues, it.criteria, result.data))
                    }
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
                    loadIssues()
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

    fun loadParentCandidates(projectId: Int, excludeIssueId: Int?) {
        viewModelScope.launch {
            when (val result = issueRepository.getIssues(projectId = projectId)) {
                is Result.Success -> {
                    val excluded = if (excludeIssueId != null) {
                        collectDescendantIds(excludeIssueId, result.data)
                    } else {
                        emptySet()
                    }
                    _formUiState.update {
                        it.copy(parentCandidates = result.data.filter { issue -> issue.id !in excluded })
                    }
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
                    loadIssues()
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
