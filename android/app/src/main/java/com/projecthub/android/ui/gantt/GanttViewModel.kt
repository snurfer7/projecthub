package com.projecthub.android.ui.gantt

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.Result
import com.projecthub.android.ui.utils.buildIssueTreeDisplayRows
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class GanttRow(
    val issue: IssueDto,
    val depth: Int,
    val hasChildren: Boolean,
    val startDate: LocalDate?,
    val endDate: LocalDate?
)

data class GanttUiState(
    val isLoading: Boolean = false,
    val projectName: String = "",
    val rows: List<GanttRow> = emptyList(),
    val rangeStart: LocalDate = LocalDate.now(),
    val rangeEnd: LocalDate = LocalDate.now(),
    val error: String? = null
)

private fun parseDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try {
        LocalDate.parse(value.take(10))
    } catch (e: Exception) {
        null
    }
}

@HiltViewModel
class GanttViewModel @Inject constructor(
    private val issueRepository: IssueRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(GanttUiState())
    val uiState: StateFlow<GanttUiState> = _uiState.asStateFlow()

    fun load(projectId: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            when (val result = issueRepository.getProjectGantt(projectId)) {
                is Result.Success -> {
                    val issues = result.data.issues
                    val treeRows = buildIssueTreeDisplayRows(issues, emptySet())
                    val rows = treeRows.map { row ->
                        val start = parseDate(row.issue.startDate ?: row.issue.dueDate)
                        val end = parseDate(row.issue.endDate ?: row.issue.dueDate ?: row.issue.startDate)
                        GanttRow(row.issue, row.depth, row.hasChildren, start, end)
                    }
                    val allDates = rows.flatMap { listOfNotNull(it.startDate, it.endDate) }
                    val today = LocalDate.now()
                    val rangeStart = (allDates.minOrNull() ?: today).minusDays(3)
                    val rangeEnd = (allDates.maxOrNull() ?: today).plusDays(21)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            projectName = result.data.project.name,
                            rows = rows,
                            rangeStart = rangeStart,
                            rangeEnd = rangeEnd
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }
}
