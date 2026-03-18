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
public final class IssueRepository_Factory implements Factory<IssueRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public IssueRepository_Factory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public IssueRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static IssueRepository_Factory create(Provider<ApiServiceProvider> apiServiceProvider) {
    return new IssueRepository_Factory(apiServiceProvider);
  }

  public static IssueRepository newInstance(ApiServiceProvider apiServiceProvider) {
    return new IssueRepository(apiServiceProvider);
  }
}
