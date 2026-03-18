package com.projecthub.android.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.IssueDto
import com.projecthub.android.data.api.models.ProjectDto
import com.projecthub.android.data.local.PreferencesManager
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.ProjectRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val isLoading: Boolean = false,
    val projects: List<ProjectDto> = emptyList(),
    val recentIssues: List<IssueDto> = emptyList(),
    val userName: String = "",
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val projectRepository: ProjectRepository,
    private val issueRepository: IssueRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
        observeUserName()
    }

    private fun observeUserName() {
        viewModelScope.launch {
            combine(
                preferencesManager.userFirstName,
                preferencesManager.userLastName
            ) { firstName, lastName ->
                "${lastName ?: ""} ${firstName ?: ""}".trim()
            }.collect { name ->
                _uiState.update { it.copy(userName = name) }
            }
        }
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val projectsResult = projectRepository.getProjects()
            val issuesResult = issueRepository.getIssues()

            val projects = when (projectsResult) {
                is Result.Success -> projectsResult.data
                is Result.Error -> {
                    _uiState.update { it.copy(error = projectsResult.message) }
                    emptyList()
                }
                else -> emptyList()
            }

            val issues = when (issuesResult) {
                is Result.Success -> issuesResult.data.take(10)
                else -> emptyList()
            }

            _uiState.update { it.copy(
                isLoading = false,
                projects = projects.take(5),
                recentIssues = issues
            )}
        }
    }
}
