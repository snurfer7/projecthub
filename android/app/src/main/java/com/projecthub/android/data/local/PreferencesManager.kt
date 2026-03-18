package com.projecthub.android.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "projecthub_prefs")

@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("auth_token")
        private val USER_ID_KEY = intPreferencesKey("user_id")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        private val USER_FIRST_NAME_KEY = stringPreferencesKey("user_first_name")
        private val USER_LAST_NAME_KEY = stringPreferencesKey("user_last_name")
        private val USER_ROLE_KEY = stringPreferencesKey("user_role")
        private val BASE_URL_KEY = stringPreferencesKey("base_url")

        const val DEFAULT_BASE_URL = "http://10.0.2.2:3000/"
    }

    val authToken: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[TOKEN_KEY]
    }

    val userId: Flow<Int?> = context.dataStore.data.map { prefs ->
        prefs[USER_ID_KEY]
    }

    val userEmail: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_EMAIL_KEY]
    }

    val userFirstName: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_FIRST_NAME_KEY]
    }

    val userLastName: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_LAST_NAME_KEY]
    }

    val userRole: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[USER_ROLE_KEY]
    }

    val baseUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[BASE_URL_KEY] ?: DEFAULT_BASE_URL
    }

    suspend fun saveAuthToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
        }
    }

    suspend fun saveUserInfo(id: Int, email: String, firstName: String, lastName: String, role: String) {
        context.dataStore.edit { prefs ->
            prefs[USER_ID_KEY] = id
            prefs[USER_EMAIL_KEY] = email
            prefs[USER_FIRST_NAME_KEY] = firstName
            prefs[USER_LAST_NAME_KEY] = lastName
            prefs[USER_ROLE_KEY] = role
        }
    }

    suspend fun saveBaseUrl(url: String) {
        val normalizedUrl = if (url.endsWith("/")) url else "$url/"
        context.dataStore.edit { prefs ->
            prefs[BASE_URL_KEY] = normalizedUrl
        }
    }

    suspend fun clearAuthData() {
        context.dataStore.edit { prefs ->
            prefs.remove(TOKEN_KEY)
            prefs.remove(USER_ID_KEY)
            prefs.remove(USER_EMAIL_KEY)
            prefs.remove(USER_FIRST_NAME_KEY)
            prefs.remove(USER_LAST_NAME_KEY)
            prefs.remove(USER_ROLE_KEY)
        }
    }
}
