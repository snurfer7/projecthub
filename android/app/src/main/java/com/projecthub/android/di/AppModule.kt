package com.projecthub.android.di

import android.content.Context
import com.projecthub.android.data.local.PreferencesManager
import com.projecthub.android.data.repository.ApiServiceProvider
import com.projecthub.android.data.repository.AuthRepository
import com.projecthub.android.data.repository.CompanyRepository
import com.projecthub.android.data.repository.IssueRepository
import com.projecthub.android.data.repository.ProjectRepository
import com.projecthub.android.data.repository.TimeRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun providePreferencesManager(@ApplicationContext context: Context): PreferencesManager {
        return PreferencesManager(context)
    }

    @Provides
    @Singleton
    fun provideApiServiceProvider(preferencesManager: PreferencesManager): ApiServiceProvider {
        return ApiServiceProvider(preferencesManager)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        apiServiceProvider: ApiServiceProvider,
        preferencesManager: PreferencesManager
    ): AuthRepository {
        return AuthRepository(apiServiceProvider, preferencesManager)
    }

    @Provides
    @Singleton
    fun provideProjectRepository(apiServiceProvider: ApiServiceProvider): ProjectRepository {
        return ProjectRepository(apiServiceProvider)
    }

    @Provides
    @Singleton
    fun provideIssueRepository(apiServiceProvider: ApiServiceProvider): IssueRepository {
        return IssueRepository(apiServiceProvider)
    }

    @Provides
    @Singleton
    fun provideTimeRepository(apiServiceProvider: ApiServiceProvider): TimeRepository {
        return TimeRepository(apiServiceProvider)
    }

    @Provides
    @Singleton
    fun provideCompanyRepository(apiServiceProvider: ApiServiceProvider): CompanyRepository {
        return CompanyRepository(apiServiceProvider)
    }
}
