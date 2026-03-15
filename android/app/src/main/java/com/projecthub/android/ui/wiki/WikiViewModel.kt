package com.projecthub.android.ui.wiki

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.api.models.WikiPageDto
import com.projecthub.android.data.repository.ProjectRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WikiListUiState(
    val isLoading: Boolean = false,
    val pages: List<WikiPageDto> = emptyList(),
    val error: String? = null
)

data class WikiDetailUiState(
    val isLoading: Boolean = false,
    val page: WikiPageDto? = null,
    val error: String? = null
)

@HiltViewModel
class WikiViewModel @Inject constructor(
    private val projectRepository: ProjectRepository
) : ViewModel() {

    private val _listUiState = MutableStateFlow(WikiListUiState())
    val listUiState: StateFlow<WikiListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow(WikiDetailUiState())
    val detailUiState: StateFlow<WikiDetailUiState> = _detailUiState.asStateFlow()

    fun loadWikiPages(projectId: Int) {
        viewModelScope.launch {
            _listUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = projectRepository.getWikiPages(projectId)) {
                is Result.Success -> {
                    _listUiState.update { it.copy(isLoading = false, pages = result.data) }
                }
                is Result.Error -> {
                    _listUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }

    fun loadWikiPage(projectId: Int, pageId: Int) {
        viewModelScope.launch {
            _detailUiState.update { it.copy(isLoading = true, error = null) }
            when (val result = projectRepository.getWikiPage(projectId, pageId)) {
                is Result.Success -> {
                    _detailUiState.update { it.copy(isLoading = false, page = result.data) }
                }
                is Result.Error -> {
                    _detailUiState.update { it.copy(isLoading = false, error = result.message) }
                }
                else -> {}
            }
        }
    }
}
