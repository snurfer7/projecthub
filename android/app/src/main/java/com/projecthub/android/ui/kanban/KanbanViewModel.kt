package com.projecthub.android.ui.kanban

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.IssueMetaOptions
import com.projecthub.android.data.api.models.IssueStatusDto
import com.projecthub.android.data.api.models.UpdateIssueRequest
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class KanbanUiState(
    val isLoading: Boolean = false,
    val columns: Map<IssueStatusDto, List<IssueDto>> = emptyMap(),
    val metaOptions: IssueMetaOptions? = null,
    val error: String? = null,
    val updatingIssueId: Int? = null
)

@HiltViewModel
class KanbanViewModel @Inject constructor(
    private val issueRepository: IssueRepository
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
                    val issues = issuesResult.data
                    val statuses = metaOptions?.statuses ?: emptyList()

                    // Group issues by status
                    val columns = statuses.associateWith { status ->
                        issues.filter { it.statusId == status.id }
                            .sortedBy { it.position }
                    }

                    _uiState.update { it.copy(
                        isLoading = false,
                        columns = columns,
                        metaOptions = metaOptions
                    )}
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = issuesResult.message) }
                }
                else -> {}
            }
        }
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
                    // Update local state optimistically
                    val currentColumns = _uiState.value.columns.toMutableMap()
                    val updatedIssue = result.data

                    // Remove from old column
                    currentColumns.forEach { (status, issues) ->
                        currentColumns[status] = issues.filter { it.id != issue.id }
                    }

                    // Add to new column
                    val newStatus = _uiState.value.metaOptions?.statuses?.find { it.id == newStatusId }
                    if (newStatus != null) {
                        val oldList = currentColumns[newStatus] ?: emptyList()
                        currentColumns[newStatus] = oldList + updatedIssue
                    }

                    _uiState.update { it.copy(updatingIssueId = null, columns = currentColumns) }
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
