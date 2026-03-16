package com.projecthub.android.di;

import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.ProjectRepository;
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
public final class AppModule_ProvideProjectRepositoryFactory implements Factory<ProjectRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public AppModule_ProvideProjectRepositoryFactory(
      Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public ProjectRepository get() {
    return provideProjectRepository(apiServiceProvider.get());
  }

  public static AppModule_ProvideProjectRepositoryFactory create(
      Provider<ApiServiceProvider> apiServiceProvider) {
    return new AppModule_ProvideProjectRepositoryFactory(apiServiceProvider);
  }

  public static ProjectRepository provideProjectRepository(ApiServiceProvider apiServiceProvider) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideProjectRepository(apiServiceProvider));
  }
}
