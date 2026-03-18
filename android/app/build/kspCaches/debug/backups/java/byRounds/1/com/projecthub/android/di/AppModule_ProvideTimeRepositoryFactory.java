package com.projecthub.android.di;

import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.TimeRepository;
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
public final class AppModule_ProvideTimeRepositoryFactory implements Factory<TimeRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public AppModule_ProvideTimeRepositoryFactory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public TimeRepository get() {
    return provideTimeRepository(apiServiceProvider.get());
  }

  public static AppModule_ProvideTimeRepositoryFactory create(
      Provider<ApiServiceProvider> apiServiceProvider) {
    return new AppModule_ProvideTimeRepositoryFactory(apiServiceProvider);
  }

  public static TimeRepository provideTimeRepository(ApiServiceProvider apiServiceProvider) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideTimeRepository(apiServiceProvider));
  }
}
