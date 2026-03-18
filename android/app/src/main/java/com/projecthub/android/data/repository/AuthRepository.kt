package com.projecthub.android.data.repository

import com.projecthub.android.data.api.ApiService
import com.projecthub.android.data.api.models.AuthResponse
import com.projecthub.android.data.api.models.LoginRequest
import com.projecthub.android.data.api.models.RegisterRequest
import com.projecthub.android.data.api.models.UserDto
import com.projecthub.android.data.local.PreferencesManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

@Singleton
class AuthRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider,
    private val preferencesManager: PreferencesManager
) {
    val authToken: Flow<String?> = preferencesManager.authToken
    val userId: Flow<Int?> = preferencesManager.userId
    val userEmail: Flow<String?> = preferencesManager.userEmail
    val userFirstName: Flow<String?> = preferencesManager.userFirstName
    val userLastName: Flow<String?> = preferencesManager.userLastName

    suspend fun login(email: String, password: String): Result<AuthResponse> {
        return try {
            val response = apiServiceProvider.get().login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()!!
                preferencesManager.saveAuthToken(body.token)
                preferencesManager.saveUserInfo(
                    id = body.user.id,
                    email = body.user.email,
                    firstName = body.user.firstName,
                    lastName = body.user.lastName,
                    role = body.user.role
                )
                Result.Success(body)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "ログインに失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun register(email: String, password: String, firstName: String, lastName: String): Result<AuthResponse> {
        return try {
            val response = apiServiceProvider.get().register(
                RegisterRequest(email, password, firstName, lastName)
            )
            if (response.isSuccessful) {
                val body = response.body()!!
                preferencesManager.saveAuthToken(body.token)
                preferencesManager.saveUserInfo(
                    id = body.user.id,
                    email = body.user.email,
                    firstName = body.user.firstName,
                    lastName = body.user.lastName,
                    role = body.user.role
                )
                Result.Success(body)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "登録に失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getMe(): Result<UserDto> {
        return try {
            val response = apiServiceProvider.get().getMe()
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("ユーザー情報の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun logout() {
        preferencesManager.clearAuthData()
    }

    suspend fun isLoggedIn(): Boolean {
        return preferencesManager.authToken.first() != null
    }
}
