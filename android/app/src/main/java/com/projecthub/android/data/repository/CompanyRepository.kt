package com.projecthub.android.data.repository

import com.projecthub.android.data.api.models.*
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
                Result.Error("企業情報の取得に失敗しました")
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
                Result.Error("企業情報の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createCompany(request: CreateCompanyRequest): Result<CompanyDto> {
        return try {
            val response = apiServiceProvider.get().createCompany(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("企業の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun updateCompany(id: Int, request: UpdateCompanyRequest): Result<CompanyDto> {
        return try {
            val response = apiServiceProvider.get().updateCompany(id, request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("企業の更新に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun deleteCompany(id: Int): Result<Unit> {
        return try {
            val response = apiServiceProvider.get().deleteCompany(id)
            if (response.isSuccessful) {
                Result.Success(Unit)
            } else {
                Result.Error("企業の削除に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getLegalEntityStatuses(): Result<List<LegalEntityStatusDto>> {
        return try {
            val response = apiServiceProvider.get().getLegalEntityStatuses()
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("法人格の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createContact(request: CreateContactRequest): Result<ContactDto> {
        return try {
            val response = apiServiceProvider.get().createContact(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("連絡先の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getDeals(companyId: Int): Result<List<DealDto>> {
        return try {
            val response = apiServiceProvider.get().getDeals(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("商談の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createDeal(request: CreateDealRequest): Result<DealDto> {
        return try {
            val response = apiServiceProvider.get().createDeal(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("商談の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getActivities(companyId: Int): Result<List<ActivityDto>> {
        return try {
            val response = apiServiceProvider.get().getActivities(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("活動履歴の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createActivity(request: CreateActivityRequest): Result<ActivityDto> {
        return try {
            val response = apiServiceProvider.get().createActivity(request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("活動の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getContacts(companyId: Int): Result<List<ContactDto>> {
        return try {
            val response = apiServiceProvider.get().getContacts(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("連絡先の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getLocations(companyId: Int): Result<List<LocationDto>> {
        return try {
            val response = apiServiceProvider.get().getLocations(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("拠点の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getCompanyWikiPages(companyId: Int): Result<List<CompanyWikiPageDto>> {
        return try {
            val response = apiServiceProvider.get().getCompanyWikiPages(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("Wiki の取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun getCompanyComments(companyId: Int): Result<List<CompanyCommentDto>> {
        return try {
            val response = apiServiceProvider.get().getCompanyComments(companyId)
            if (response.isSuccessful) {
                Result.Success(response.body() ?: emptyList())
            } else {
                Result.Error("コメントの取得に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun addCompanyComment(companyId: Int, content: String): Result<CompanyCommentDto> {
        return try {
            val response = apiServiceProvider.get().addCompanyComment(companyId, AddCommentRequest(content))
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("コメントの追加に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }

    suspend fun createLocation(companyId: Int, request: CreateLocationRequest): Result<LocationDto> {
        return try {
            val response = apiServiceProvider.get().createLocation(companyId, request)
            if (response.isSuccessful) {
                Result.Success(response.body()!!)
            } else {
                Result.Error("拠点の作成に失敗しました")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "ネットワークエラーが発生しました")
        }
    }
}
