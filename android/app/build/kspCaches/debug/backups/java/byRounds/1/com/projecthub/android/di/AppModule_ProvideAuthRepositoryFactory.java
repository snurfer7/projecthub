package com.projecthub.android.di;

import com.projecthub.android.data.local.PreferencesManager;
import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.AuthRepository;
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
public final class AppModule_ProvideAuthRepositoryFactory implements Factory<AuthRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  private final Provider<PreferencesManager> preferencesManagerProvider;

  public AppModule_ProvideAuthRepositoryFactory(Provider<ApiServiceProvider> apiServiceProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    this.apiServiceProvider = apiServiceProvider;
    this.preferencesManagerProvider = preferencesManagerProvider;
  }

  @Override
  public AuthRepository get() {
    return provideAuthRepository(apiServiceProvider.get(), preferencesManagerProvider.get());
  }

  public static AppModule_ProvideAuthRepositoryFactory create(
      Provider<ApiServiceProvider> apiServiceProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    return new AppModule_ProvideAuthRepositoryFactory(apiServiceProvider, preferencesManagerProvider);
  }

  public static AuthRepository provideAuthRepository(ApiServiceProvider apiServiceProvider,
      PreferencesManager preferencesManager) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideAuthRepository(apiServiceProvider, preferencesManager));
  }
}
