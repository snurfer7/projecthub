package com.projecthub.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.projecthub.android.data.repository.AuthRepository
import com.projecthub.android.data.repository.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val error: String? = null,
    val isCheckingAuth: Boolean = true
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        checkAuthStatus()
    }

    private fun checkAuthStatus() {
        viewModelScope.launch {
            val isLoggedIn = authRepository.isLoggedIn()
            _uiState.value = _uiState.value.copy(
                isLoggedIn = isLoggedIn,
                isCheckingAuth = false
            )
        }
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "メールアドレスとパスワードを入力してください")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.login(email, password)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
                else -> {}
            }
        }
    }

    fun register(email: String, password: String, firstName: String, lastName: String) {
        if (email.isBlank() || password.isBlank() || firstName.isBlank() || lastName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "すべての項目を入力してください")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.register(email, password, firstName, lastName)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isLoggedIn = true)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
                else -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
