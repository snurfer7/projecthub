package com.projecthub.android.di;

import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.IssueRepository;
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
public final class AppModule_ProvideIssueRepositoryFactory implements Factory<IssueRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public AppModule_ProvideIssueRepositoryFactory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public IssueRepository get() {
    return provideIssueRepository(apiServiceProvider.get());
  }

  public static AppModule_ProvideIssueRepositoryFactory create(
      Provider<ApiServiceProvider> apiServiceProvider) {
    return new AppModule_ProvideIssueRepositoryFactory(apiServiceProvider);
  }

  public static IssueRepository provideIssueRepository(ApiServiceProvider apiServiceProvider) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideIssueRepository(apiServiceProvider));
  }
}
