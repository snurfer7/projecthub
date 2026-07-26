package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IssueRepository @Inject constructor(
    private val apiServiceProvider: ApiServiceProvider
) {
    suspend fun getIssues(
        projectId: Int? = null,
        statusId: Int? = null,
        trackerId: Int? = null,
        priorityId: Int? = null,
        assignedToId: Int? = null
    ): Result<List<IssueDto>> {
        return try {
            val response = apiServiceProvider.get().getIssues(
                projectId = projectId,
                statusId = statusId,
                trackerId = trackerId,
                priorityId = priorityId,
                assignedToId = assignedToId
            )
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("チケットの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getIssue(id: Int): Result<IssueDto> {
        return try {
            val response = apiServiceProvider.get().getIssue(id)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("チケットの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createIssue(request: CreateIssueRequest): Result<IssueDto> {
        return try {
            val response = apiServiceProvider.get().createIssue(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "チケットの作成に失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun updateIssue(id: Int, request: UpdateIssueRequest): Result<IssueDto> {
        return try {
            val response = apiServiceProvider.get().updateIssue(id, request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "チケットの更新に失敗しました"
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun deleteIssue(id: Int): Result<Unit> {
        return try {
            val response = apiServiceProvider.get().deleteIssue(id)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("チケットの削除に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getMetaOptions(projectId: Int? = null): Result<IssueMetaOptions> {
        return try {
            val response = apiServiceProvider.get().getIssueMetaOptions(projectId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("メタデータの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getProjectGantt(projectId: Int): Result<GanttProjectResponse> {
        return try {
            val response = apiServiceProvider.get().getProjectGantt(projectId)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else if (response.code() == 403) {
                Result.Error("ガントの閲覧権限がありません")
            } else {
                Result.Error("ガントチャートの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun addComment(issueId: Int, content: String): Result<IssueCommentDto> {
        return try {
            val response = apiServiceProvider.get().addComment(issueId, AddCommentRequest(content))
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("コメントの追加に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
