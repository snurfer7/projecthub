package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.ProjectDto
import com.projecthub.android.data.api.models.WikiPageDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProjectRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider
) {
    suspend fun getProjects(): Result<List<ProjectDto>> {
        return try {
            val response = apiServiceProvider.get().getProjects()
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("プロジェクトの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getProject(id: Int): Result<ProjectDto> {
        return try {
            val response = apiServiceProvider.get().getProject(id)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("プロジェクトの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getWikiPages(projectId: Int): Result<List<WikiPageDto>> {
        return try {
            val response = apiServiceProvider.get().getWikiPages(projectId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("Wikiページの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getWikiPage(projectId: Int, pageId: Int): Result<WikiPageDto> {
        return try {
            val response = apiServiceProvider.get().getWikiPage(projectId, pageId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("Wikiページの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
