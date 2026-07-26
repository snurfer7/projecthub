package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.CreateSavedSearchRequest
import com.projecthub.android.data.api.models.SavedSearchDto
import com.projecthub.android.data.api.models.UpdateSavedSearchRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SavedSearchRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider
) {
    suspend fun getSavedSearches(viewMode: String): Result<List<SavedSearchDto>> {
        return try {
            val response = apiServiceProvider.get().getSavedSearches(viewMode)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("保存済み検索の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createSavedSearch(request: CreateSavedSearchRequest): Result<SavedSearchDto> {
        return try {
            val response = apiServiceProvider.get().createSavedSearch(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("保存済み検索の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun updateSavedSearch(id: Int, request: UpdateSavedSearchRequest): Result<SavedSearchDto> {
        return try {
            val response = apiServiceProvider.get().updateSavedSearch(id, request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("保存済み検索の更新に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun deleteSavedSearch(id: Int): Result<Unit> {
        return try {
            val response = apiServiceProvider.get().deleteSavedSearch(id)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("保存済み検索の削除に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
