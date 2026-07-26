package com.projecthub.android.ui.kanban

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.IssueMetaOptions
import com.projecthub.android.data.api.models.IssueStatusDto
import com.projecthub.android.data.api.models.SavedSearchDto
import com.projecthub.android.data.api.models.CreateSavedSearchRequest
import com.projecthub.android.data.api.models.UpdateSavedSearchRequest
import com.projecthub.android.data.api.models.SAVED_SEARCH_VIEW_MODE_KANBAN
import com.projecthub.android.data.api.models.UpdateIssueRequest
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.Result
import com.projecthub.android.data.repository.SavedSearchRepository
import com.projecthub.android.ui.issues.androidOnly
import com.projecthub.android.ui.issues.toFilterJson
import com.projecthub.android.ui.issues.toIssueFilterCriteriaOrNull
import com.projecthub.android.ui.utils.IssueFilterCriteria
import com.projecthub.android.ui.utils.buildIssueByIdMap
import com.projecthub.android.ui.utils.filterIssues
import com.projecthub.android.ui.utils.getAncestorChain
import com.projecthub.android.ui.utils.isLeafIssue
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class KanbanUiState(
    val isLoading: Boolean = false,
    val allIssues: List<IssueDto> = emptyList(),
    val columns: Map<IssueStatusDto, List<IssueDto>> = emptyMap(),
    val metaOptions: IssueMetaOptions? = null,
    val criteria: IssueFilterCriteria = IssueFilterCriteria(),
    val ancestorLabels: Map<Int, String> = emptyMap(),
    val error: String? = null,
    val updatingIssueId: Int? = null,
    val savedSearches: List<SavedSearchDto> = emptyList(),
    val hasAppliedDefaultSavedSearch: Boolean = false
)

@HiltViewModel
class KanbanViewModel @Inject constructor(
    private val issueRepository: IssueRepository,
    private val savedSearchRepository: SavedSearchRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(KanbanUiState())
    val uiState: StateFlow<KanbanUiState> = _uiState.asStateFlow()

    fun loadKanban(projectId: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val metaResult = issueRepository.getMetaOptions(projectId)
            val issuesResult = issueRepository.getIssues(projectId = projectId)

            val metaOptions = when (metaResult) {
                is Result.Success -> metaResult.data
                else -> null
            }

            when (issuesResult) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(isLoading = false, allIssues = issuesResult.data, metaOptions = metaOptions)
                    }
                    recomputeColumns()
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = issuesResult.message) }
                }
                else -> {}
            }
        }
    }

    fun setCriteria(criteria: IssueFilterCriteria) {
        _uiState.update { it.copy(criteria = criteria) }
        recomputeColumns()
    }

    fun loadSavedSearches() {
        viewModelScope.launch {
            when (val result = savedSearchRepository.getSavedSearches(SAVED_SEARCH_VIEW_MODE_KANBAN)) {
                is Result.Success -> {
                    val searches = result.data.androidOnly()
                    _uiState.update { it.copy(savedSearches = searches) }
                    if (!_uiState.value.hasAppliedDefaultSavedSearch) {
                        searches.find { it.isDefault }?.filter?.toIssueFilterCriteriaOrNull()?.let { criteria ->
                            setCriteria(criteria)
                        }
                        _uiState.update { it.copy(hasAppliedDefaultSavedSearch = true) }
                    }
                }
                else -> {}
            }
        }
    }

    fun saveCurrentSearch(name: String, isDefault: Boolean) {
        viewModelScope.launch {
            val request = CreateSavedSearchRequest(
                viewMode = SAVED_SEARCH_VIEW_MODE_KANBAN,
                name = name,
                filter = _uiState.value.criteria.toFilterJson(),
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

    private fun recomputeColumns() {
        val state = _uiState.value
        val allIssues = state.allIssues
        val byId = buildIssueByIdMap(allIssues)
        val leafIssues = allIssues.filter { isLeafIssue(it, allIssues) }
        val visible = filterIssues(leafIssues, state.criteria, state.metaOptions)
        val statuses = state.metaOptions?.statuses ?: emptyList()

        val columns = statuses.associateWith { status ->
            visible.filter { it.statusId == status.id }.sortedBy { it.position }
        }
        val ancestorLabels = visible
            .filter { it.parentId != null }
            .associate { it.id to getAncestorChain(it, byId).joinToString(" / ") { ref -> ref.subject } }

        _uiState.update { it.copy(columns = columns, ancestorLabels = ancestorLabels) }
    }

    fun moveIssueToStatus(issue: IssueDto, newStatusId: Int, projectId: Int) {
        if (issue.statusId == newStatusId) return

        viewModelScope.launch {
            _uiState.update { it.copy(updatingIssueId = issue.id) }

            val request = UpdateIssueRequest(
                statusId = newStatusId,
                trackerId = null, priorityId = null, assignedToId = null,
                assignedToGroupId = null, subject = null, description = null,
                startDate = null, dueDate = null, estimatedHours = null, doneRatio = null
            )

            when (val result = issueRepository.updateIssue(issue.id, request)) {
                is Result.Success -> {
                    val updatedIssue = result.data
                    _uiState.update { state ->
                        state.copy(
                            updatingIssueId = null,
                            allIssues = state.allIssues.map { if (it.id == updatedIssue.id) updatedIssue else it }
                        )
                    }
                    recomputeColumns()
                }
                is Result.Error -> {
                    _uiState.update { it.copy(updatingIssueId = null, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
