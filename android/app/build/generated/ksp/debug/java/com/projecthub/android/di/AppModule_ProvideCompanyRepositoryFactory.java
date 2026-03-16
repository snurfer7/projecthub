package com.projecthub.android.di;

import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.CompanyRepository;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
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
public final class AppModule_ProvideCompanyRepositoryFactory implements Factory<CompanyRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public AppModule_ProvideCompanyRepositoryFactory(
      Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public CompanyRepository get() {
    return provideCompanyRepository(apiServiceProvider.get());
  }

  public static AppModule_ProvideCompanyRepositoryFactory create(
      Provider<ApiServiceProvider> apiServiceProvider) {
    return new AppModule_ProvideCompanyRepositoryFactory(apiServiceProvider);
  }

  public static CompanyRepository provideCompanyRepository(ApiServiceProvider apiServiceProvider) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideCompanyRepository(apiServiceProvider));
  }
}
