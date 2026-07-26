package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.ActivityDto
import com.projecthub.android.data.api.models.CreateProjectRequest
import com.projecthub.android.data.api.models.LinkActivityRequest
import com.projecthub.android.data.api.models.LinkActivityResponse
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

    suspend fun createProject(request: CreateProjectRequest): Result<ProjectDto> {
        return try {
            val response = apiServiceProvider.get().createProject(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("プロジェクトの作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getProjectActivities(projectId: Int): Result<List<ActivityDto>> {
        return try {
            val response = apiServiceProvider.get().getProjectActivities(projectId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else if (response.code() == 403) {
                Result.Error("関連活動の閲覧権限がありません")
            } else {
                Result.Error("関連活動の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun linkProjectActivity(projectId: Int, activityId: Int): Result<LinkActivityResponse> {
        return try {
            val response = apiServiceProvider.get().linkProjectActivity(projectId, LinkActivityRequest(activityId))
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "活動の紐づけに失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun unlinkProjectActivity(projectId: Int, activityId: Int): Result<Unit> {
        return try {
            val response = apiServiceProvider.get().unlinkProjectActivity(projectId, activityId)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("活動の紐づけ解除に失敗しました")
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

    suspend fun getWikiPage(pageId: Int): Result<WikiPageDto> {
        return try {
            val response = apiServiceProvider.get().getWikiPage(pageId)
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
