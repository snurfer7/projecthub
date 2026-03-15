package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.CreateTimeEntryRequest
import com.projecthub.android.data.api.models.TimeEntryDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TimeRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider
) {
    suspend fun getTimeEntries(
        projectId: Int? = null,
        userId: Int? = null
    ): Result<List<TimeEntryDto>> {
        return try {
            val response = apiServiceProvider.get().getTimeEntries(projectId, userId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("作業時間の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createTimeEntry(request: CreateTimeEntryRequest): Result<TimeEntryDto> {
        return try {
            val response = apiServiceProvider.get().createTimeEntry(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "作業時間の記録に失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun deleteTimeEntry(id: Int): Result<Unit> {
        return try {
            val response = apiServiceProvider.get().deleteTimeEntry(id)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("作業時間の削除に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
