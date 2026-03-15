package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.CompanyDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CompanyRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider
) {
    suspend fun getCompanies(): Result<List<CompanyDto>> {
        return try {
            val response = apiServiceProvider.get().getCompanies()
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("会社情報の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getCompany(id: Int): Result<CompanyDto> {
        return try {
            val response = apiServiceProvider.get().getCompany(id)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("会社情報の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
