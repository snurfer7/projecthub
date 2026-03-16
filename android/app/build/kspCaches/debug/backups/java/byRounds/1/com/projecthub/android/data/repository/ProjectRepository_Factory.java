package com.projecthub.android.data.repository;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class ProjectRepository_Factory implements Factory<ProjectRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public ProjectRepository_Factory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public ProjectRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static ProjectRepository_Factory create(Provider<ApiServiceProvider> apiServiceProvider) {
    return new ProjectRepository_Factory(apiServiceProvider);
  }

  public static ProjectRepository newInstance(ApiServiceProvider apiServiceProvider) {
    return new ProjectRepository(apiServiceProvider);
  }
}
