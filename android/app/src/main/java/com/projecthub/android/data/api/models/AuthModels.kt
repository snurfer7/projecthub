package com.projecthub.android.data.api.models

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String
)

data class AuthResponse(
    val token: String,
    val user: UserDto
)

data class UserDto(
    val id: Int,
    val email: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    val role: String,
    @SerializedName("isAdmin") val isAdmin: Boolean,
    @SerializedName("landingPage") val landingPage: String? = "home",
    @SerializedName("showProjectsMenu") val showProjectsMenu: Boolean = true,
    @SerializedName("showGanttMenu") val showGanttMenu: Boolean = true,
    @SerializedName("showCompanyMenu") val showCompanyMenu: Boolean = true,
    @SerializedName("showAdminMenu") val showAdminMenu: Boolean = true
) {
    val fullName: String get() = "$firstName $lastName"
}
