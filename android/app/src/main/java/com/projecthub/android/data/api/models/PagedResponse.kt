package com.projecthub.android.data.api.models

data class PagedResponse<T>(
    val items: List<T>,
    val total: Int,
    val page: Int,
    val pageSize: Int,
    val totalPages: Int
)
