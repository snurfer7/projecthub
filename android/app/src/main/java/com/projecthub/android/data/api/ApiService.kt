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

    @POST("api/projects")
    suspend fun createProject(@Body request: CreateProjectRequest): Response<ProjectDto>

    // Issues
    @GET("api/issues")
    suspend fun getIssues(
        @Query("projectId") projectId: Int? = null,
        @Query("statusId") statusId: Int? = null,
        @Query("trackerId") trackerId: Int? = null,
        @Query("priorityId") priorityId: Int? = null,
        @Query("assignedToId") assignedToId: Int? = null,
        @Query("assignedToGroupId") assignedToGroupId: Int? = null
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

    @PUT("api/time-entries/{id}")
    suspend fun updateTimeEntry(
        @Path("id") id: Int,
        @Body request: UpdateTimeEntryRequest
    ): Response<TimeEntryDto>

    @DELETE("api/time-entries/{id}")
    suspend fun deleteTimeEntry(@Path("id") id: Int): Response<Unit>

    // Companies
    @GET("api/companies")
    suspend fun getCompanies(): Response<List<CompanyDto>>

    @GET("api/companies/{id}")
    suspend fun getCompany(@Path("id") id: Int): Response<CompanyDto>

    @POST("api/companies")
    suspend fun createCompany(@Body request: CreateCompanyRequest): Response<CompanyDto>

    @PUT("api/companies/{id}")
    suspend fun updateCompany(
        @Path("id") id: Int,
        @Body request: UpdateCompanyRequest
    ): Response<CompanyDto>

    @DELETE("api/companies/{id}")
    suspend fun deleteCompany(@Path("id") id: Int): Response<Unit>

    @GET("api/companies/{companyId}/locations")
    suspend fun getLocations(@Path("companyId") companyId: Int): Response<List<LocationDto>>

    @POST("api/companies/{companyId}/locations")
    suspend fun createLocation(
        @Path("companyId") companyId: Int,
        @Body request: CreateLocationRequest
    ): Response<LocationDto>

    @GET("api/companies/{companyId}/wiki")
    suspend fun getCompanyWikiPages(@Path("companyId") companyId: Int): Response<List<CompanyWikiPageDto>>

    @GET("api/companies/{companyId}/comments")
    suspend fun getCompanyComments(@Path("companyId") companyId: Int): Response<List<CompanyCommentDto>>

    @POST("api/companies/{companyId}/comments")
    suspend fun addCompanyComment(
        @Path("companyId") companyId: Int,
        @Body request: AddCommentRequest
    ): Response<CompanyCommentDto>

    // Admin
    @GET("api/admin/legal-entity-statuses")
    suspend fun getLegalEntityStatuses(): Response<List<LegalEntityStatusDto>>

    // CRM - Contacts
    @GET("api/crm/contacts")
    suspend fun getContacts(@Query("companyId") companyId: Int? = null): Response<List<ContactDto>>

    @POST("api/crm/contacts")
    suspend fun createContact(@Body request: CreateContactRequest): Response<ContactDto>

    // CRM - Deals
    @GET("api/crm/deals")
    suspend fun getDeals(@Query("companyId") companyId: Int? = null): Response<List<DealDto>>

    @POST("api/crm/deals")
    suspend fun createDeal(@Body request: CreateDealRequest): Response<DealDto>

    // CRM - Activities
    @GET("api/crm/activities")
    suspend fun getActivities(@Query("companyId") companyId: Int? = null): Response<List<ActivityDto>>

    @POST("api/crm/activities")
    suspend fun createActivity(@Body request: CreateActivityRequest): Response<ActivityDto>

    // Wiki
    @GET("api/wiki/project/{projectId}")
    suspend fun getWikiPages(@Path("projectId") projectId: Int): Response<List<WikiPageDto>>

    @GET("api/wiki/{pageId}")
    suspend fun getWikiPage(
        @Path("pageId") pageId: Int
    ): Response<WikiPageDto>
}
