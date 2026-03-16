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
public final class CompanyRepository_Factory implements Factory<CompanyRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public CompanyRepository_Factory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public CompanyRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static CompanyRepository_Factory create(Provider<ApiServiceProvider> apiServiceProvider) {
    return new CompanyRepository_Factory(apiServiceProvider);
  }

  public static CompanyRepository newInstance(ApiServiceProvider apiServiceProvider) {
    return new CompanyRepository(apiServiceProvider);
  }
}
