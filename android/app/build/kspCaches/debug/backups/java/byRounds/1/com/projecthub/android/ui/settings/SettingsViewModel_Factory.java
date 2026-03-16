package com.projecthub.android.ui.settings;

import com.projecthub.android.data.local.PreferencesManager;
import com.projecthub.android.data.repository.ApiServiceProvider;
import com.projecthub.android.data.repository.AuthRepository;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
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
public final class SettingsViewModel_Factory implements Factory<SettingsViewModel> {
  private final Provider<PreferencesManager> preferencesManagerProvider;

  private final Provider<AuthRepository> authRepositoryProvider;

  private final Provider<ApiServiceProvider> apiServiceProvider;

  public SettingsViewModel_Factory(Provider<PreferencesManager> preferencesManagerProvider,
      Provider<AuthRepository> authRepositoryProvider,
      Provider<ApiServiceProvider> apiServiceProvider) {
    this.preferencesManagerProvider = preferencesManagerProvider;
    this.authRepositoryProvider = authRepositoryProvider;
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public SettingsViewModel get() {
    return newInstance(preferencesManagerProvider.get(), authRepositoryProvider.get(), apiServiceProvider.get());
  }

  public static SettingsViewModel_Factory create(
      Provider<PreferencesManager> preferencesManagerProvider,
      Provider<AuthRepository> authRepositoryProvider,
      Provider<ApiServiceProvider> apiServiceProvider) {
    return new SettingsViewModel_Factory(preferencesManagerProvider, authRepositoryProvider, apiServiceProvider);
  }

  public static SettingsViewModel newInstance(PreferencesManager preferencesManager,
      AuthRepository authRepository, ApiServiceProvider apiServiceProvider) {
    return new SettingsViewModel(preferencesManager, authRepository, apiServiceProvider);
  }
}
