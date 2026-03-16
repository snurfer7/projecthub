package com.projecthub.android.data.repository;

import com.projecthub.android.data.local.PreferencesManager;
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
public final class AuthRepository_Factory implements Factory<AuthRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  private final Provider<PreferencesManager> preferencesManagerProvider;

  public AuthRepository_Factory(Provider<ApiServiceProvider> apiServiceProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    this.apiServiceProvider = apiServiceProvider;
    this.preferencesManagerProvider = preferencesManagerProvider;
  }

  @Override
  public AuthRepository get() {
    return newInstance(apiServiceProvider.get(), preferencesManagerProvider.get());
  }

  public static AuthRepository_Factory create(Provider<ApiServiceProvider> apiServiceProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    return new AuthRepository_Factory(apiServiceProvider, preferencesManagerProvider);
  }

  public static AuthRepository newInstance(ApiServiceProvider apiServiceProvider,
      PreferencesManager preferencesManager) {
    return new AuthRepository(apiServiceProvider, preferencesManager);
  }
}
