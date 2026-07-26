package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class ProjectDto(
    val id: Int,
    val name: String,
    val identifier: String,
    val description: String?,
    val status: String,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("companyId") val companyId: Int?,
    @SerializedName("parentId") val parentId: Int?,
    @SerializedName("dueDate") val dueDate: String?,
    val remarks: String?,
    val company: CompanyRefDto?,
    val parent: ProjectRefDto?,
    val children: List<ProjectRefDto>?,
    val members: List<ProjectMemberDto>?,
    val groups: List<ProjectGroupDto>?,
    @SerializedName("relatedCompanies") val relatedCompanies: List<RelatedCompanyDto>?,
    @SerializedName("_count") val count: ProjectCountDto?
)

data class ProjectRefDto(
    val id: Int,
    val name: String,
    val identifier: String? = null,
    val status: String? = null
)

data class CompanyRefDto(
    val id: Int,
    val name: String
)

data class ProjectMemberDto(
    val id: Int,
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("userId") val userId: Int,
    val user: UserRefDto,
    val roles: List<ProjectMemberRoleDto>?
)

data class UserRefDto(
    val id: Int,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    val email: String? = null
) {
    val fullName: String get() = "$firstName $lastName"
}

data class ProjectMemberRoleDto(
    val id: Int,
    @SerializedName("roleId") val roleId: Int,
    val role: RoleDto?
)

data class RoleDto(
    val id: Int,
    val name: String,
    val position: Int
)

data class ProjectGroupDto(
    val id: Int,
    @SerializedName("projectId") val projectId: Int,
    @SerializedName("groupId") val groupId: Int,
    val group: GroupDto?
)

data class GroupDto(
    val id: Int,
    val name: String,
    val members: List<GroupMemberDto>?
)

data class GroupMemberDto(
    val id: Int,
    @SerializedName("userId") val userId: Int,
    val user: UserRefDto?
)

data class RelatedCompanyDto(
    val id: Int,
    @SerializedName("companyId") val companyId: Int,
    val company: CompanyRefDto?,
    val location: LocationRefDto?,
    val contact: ContactRefDto?,
    val remarks: String?
)

data class LocationRefDto(
    val id: Int,
    val name: String
)

data class ContactRefDto(
    val id: Int,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    val email: String? = null,
    val phone: String? = null
) {
    val fullName: String get() = "$firstName $lastName"
}

data class CreateProjectRequest(
    val name: String,
    val identifier: String,
    val description: String? = null,
    @SerializedName("companyId") val companyId: Int? = null,
    @SerializedName("parentId") val parentId: Int? = null,
    @SerializedName("dueDate") val dueDate: String? = null
)

data class LinkActivityRequest(
    @SerializedName("activityId") val activityId: Int
)

data class LinkActivityResponse(
    val message: String? = null,
    @SerializedName("activityId") val activityId: Int? = null,
    @SerializedName("projectId") val projectId: Int? = null
)

data class ProjectCountDto(
    val issues: Int = 0,
    @SerializedName("wikiPages") val wikiPages: Int = 0,
    val attachments: Int = 0,
    @SerializedName("timeEntries") val timeEntries: Int = 0,
    val comments: Int = 0
)

data class WikiPageDto(
    val id: Int,
    @SerializedName("projectId") val projectId: Int,
    val title: String,
    val content: String,
    @SerializedName("authorId") val authorId: Int,
    val author: UserRefDto?,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?,
    @SerializedName("parentId") val parentId: Int?,
    val position: Int,
    val children: List<WikiPageDto>?
)
