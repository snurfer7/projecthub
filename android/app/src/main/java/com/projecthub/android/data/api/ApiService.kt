package com.projecthub.android.data.api

import com.projecthub.android.data.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<UserDto>

    // Projects
    @GET("api/projects")
    suspend fun getProjects(): Response<List<ProjectDto>>

    @GET("api/projects/{id}")
    suspend fun getProject(@Path("id") id: Int): Response<ProjectDto>

    // Issues
    @GET("api/issues")
    suspend fun getIssues(
        @Query("projectId") projectId: Int? = null,
        @Query("statusId") statusId: Int? = null,
        @Query("trackerId") trackerId: Int? = null,
        @Query("priorityId") priorityId: Int? = null,
        @Query("assignedToId") assignedToId: Int? = null
    ): Response<List<IssueDto>>

    @GET("api/issues/{id}")
    suspend fun getIssue(@Path("id") id: Int): Response<IssueDto>

    @POST("api/issues")
    suspend fun createIssue(@Body request: CreateIssueRequest): Response<IssueDto>

    @PUT("api/issues/{id}")
    suspend fun updateIssue(
        @Path("id") id: Int,
        @Body request: UpdateIssueRequest
    ): Response<IssueDto>

    @DELETE("api/issues/{id}")
    suspend fun deleteIssue(@Path("id") id: Int): Response<Unit>

    @GET("api/issues/meta/options")
    suspend fun getIssueMetaOptions(
        @Query("projectId") projectId: Int? = null
    ): Response<IssueMetaOptions>

    @POST("api/issues/{id}/comments")
    suspend fun addComment(
        @Path("id") issueId: Int,
        @Body request: AddCommentRequest
    ): Response<IssueCommentDto>

    // Time Entries
    @GET("api/time-entries")
    suspend fun getTimeEntries(
        @Query("projectId") projectId: Int? = null,
        @Query("userId") userId: Int? = null
    ): Response<List<TimeEntryDto>>

    @POST("api/time-entries")
    suspend fun createTimeEntry(@Body request: CreateTimeEntryRequest): Response<TimeEntryDto>

    @DELETE("api/time-entries/{id}")
    suspend fun deleteTimeEntry(@Path("id") id: Int): Response<Unit>

    // Companies
    @GET("api/companies")
    suspend fun getCompanies(): Response<List<CompanyDto>>

    @GET("api/companies/{id}")
    suspend fun getCompany(@Path("id") id: Int): Response<CompanyDto>

    // Wiki
    @GET("api/wiki/{projectId}")
    suspend fun getWikiPages(@Path("projectId") projectId: Int): Response<List<WikiPageDto>>

    @GET("api/wiki/{projectId}/{pageId}")
    suspend fun getWikiPage(
        @Path("projectId") projectId: Int,
        @Path("pageId") pageId: Int
    ): Response<WikiPageDto>
}
