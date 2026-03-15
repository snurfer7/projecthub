package com.projecthub.android.ui.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.ProjectDto
import com.projecthub.android.data.repository.ProjectRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProjectListUiState(
    val isLoading: Boolean = false,
    val projects: List<ProjectDto> = emptyList(),
    val filteredProjects: List<ProjectDto> = emptyList(),
    val searchQuery: String = "",
    val error: String? = null
)

data class ProjectDetailUiState(
    val isLoading: Boolean = false,
    val project: ProjectDto? = null,
    val error: String? = null
)

@HiltViewModel
class ProjectViewModel @Inject constructor(
    private val projectRepository: ProjectRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(ProjectListUiState())
    val listUiState: StateFlow<ProjectListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow(ProjectDetailUiState())
    val detailUiState: StateFlow<ProjectDetailUiState> = _detailUiState.asStateFlow()

    init {
        loadProjects()
    }

    fun loadProjects() {
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = projectRepository.getProjects()) {
                is Result.Success -> {
                    _listUiState.update { state ->
                        state.copy(
                            isLoading = false,
                            projects = result.data,
                            filteredProjects = applySearch(result.data, state.searchQuery)
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
                filteredProjects = applySearch(state.projects, query)
            )
        }
    }

    private fun applySearch(projects: List<ProjectDto>, query: String): List<ProjectDto> {
        if (query.isBlank()) return projects
        return projects.filter { project ->
            project.name.contains(query, ignoreCase = true) ||
            project.identifier.contains(query, ignoreCase = true) ||
            project.description?.contains(query, ignoreCase = true) == true ||
            project.company?.name?.contains(query, ignoreCase = true) == true
        }
    }

    fun loadProject(id: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = projectRepository.getProject(id)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isLoading = false, project = result.data) }
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }
}
