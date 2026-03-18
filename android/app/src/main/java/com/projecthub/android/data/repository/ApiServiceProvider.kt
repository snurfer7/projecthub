package com.projecthub.android.data.repository

import com.projecthub.android.data.api.ApiClientFactory
import com.projecthub.android.data.api.ApiService
import com.projecthub.android.data.local.PreferencesManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiServiceProvider @Inject constructor(
    private val preferencesManager: PreferencesManager
) {
    private var currentBaseUrl: String = ""
    private var _apiService: ApiService? = null

    fun get(): ApiService {
        val baseUrl = runBlocking { preferencesManager.baseUrl.first() }
        val token = runBlocking { preferencesManager.authToken.first() }

        if (_apiService == null || baseUrl != currentBaseUrl) {
            currentBaseUrl = baseUrl
            _apiService = ApiClientFactory.create(baseUrl) {
                runBlocking { preferencesManager.authToken.first() }
            }
        }
        return _apiService!!
    }

    fun invalidate() {
        _apiService = null
        currentBaseUrl = ""
    }
}
