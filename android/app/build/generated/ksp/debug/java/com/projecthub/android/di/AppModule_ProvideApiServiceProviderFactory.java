package com.projecthub.android.di;

import com.projecthub.android.data.local.PreferencesManager;
import com.projecthub.android.data.repository.ApiServiceProvider;
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
public final class AppModule_ProvideApiServiceProviderFactory implements Factory<ApiServiceProvider> {
  private final Provider<PreferencesManager> preferencesManagerProvider;

  public AppModule_ProvideApiServiceProviderFactory(
      Provider<PreferencesManager> preferencesManagerProvider) {
    this.preferencesManagerProvider = preferencesManagerProvider;
  }

  @Override
  public ApiServiceProvider get() {
    return provideApiServiceProvider(preferencesManagerProvider.get());
  }

  public static AppModule_ProvideApiServiceProviderFactory create(
      Provider<PreferencesManager> preferencesManagerProvider) {
    return new AppModule_ProvideApiServiceProviderFactory(preferencesManagerProvider);
  }

  public static ApiServiceProvider provideApiServiceProvider(
      PreferencesManager preferencesManager) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideApiServiceProvider(preferencesManager));
  }
}
