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
public final class ApiServiceProvider_Factory implements Factory<ApiServiceProvider> {
  private final Provider<PreferencesManager> preferencesManagerProvider;

  public ApiServiceProvider_Factory(Provider<PreferencesManager> preferencesManagerProvider) {
    this.preferencesManagerProvider = preferencesManagerProvider;
  }

  @Override
  public ApiServiceProvider get() {
    return newInstance(preferencesManagerProvider.get());
  }

  public static ApiServiceProvider_Factory create(
      Provider<PreferencesManager> preferencesManagerProvider) {
    return new ApiServiceProvider_Factory(preferencesManagerProvider);
  }

  public static ApiServiceProvider newInstance(PreferencesManager preferencesManager) {
    return new ApiServiceProvider(preferencesManager);
  }
}
