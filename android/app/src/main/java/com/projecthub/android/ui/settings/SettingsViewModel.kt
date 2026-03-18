package com.projecthub.android.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.local.PreferencesManager
import com.projecthub.android.data.repository.ApiServiceProvider
import com.projecthub.android.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val baseUrl: String = PreferencesManager.DEFAULT_BASE_URL,
    val userEmail: String = "",
    val userFirstName: String = "",
    val userLastName: String = "",
    val userRole: String = "",
    val isLoggedOut: Boolean = false,
    val isSaved: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val preferencesManager: PreferencesManager,
    private val authRepository: AuthRepository,
    private val apiServiceProvider: ApiServiceProvider
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            preferencesManager.baseUrl.collect { url ->
                _uiState.update { it.copy(baseUrl = url) }
            }
        }
        viewModelScope.launch {
            preferencesManager.userEmail.collect { email ->
                _uiState.update { it.copy(userEmail = email ?: "") }
            }
        }
        viewModelScope.launch {
            preferencesManager.userFirstName.collect { firstName ->
                _uiState.update { it.copy(userFirstName = firstName ?: "") }
            }
        }
        viewModelScope.launch {
            preferencesManager.userLastName.collect { lastName ->
                _uiState.update { it.copy(userLastName = lastName ?: "") }
            }
        }
        viewModelScope.launch {
            preferencesManager.userRole.collect { role ->
                _uiState.update { it.copy(userRole = role ?: "") }
            }
        }
    }

    fun saveBaseUrl(url: String) {
        viewModelScope.launch {
            preferencesManager.saveBaseUrl(url)
            apiServiceProvider.invalidate()
            _uiState.update { it.copy(isSaved = true) }
            kotlinx.coroutines.delay(2000)
            _uiState.update { it.copy(isSaved = false) }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update { it.copy(isLoggedOut = true) }
        }
    }
}
