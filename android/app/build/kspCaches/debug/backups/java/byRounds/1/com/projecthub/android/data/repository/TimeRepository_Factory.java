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
public final class TimeRepository_Factory implements Factory<TimeRepository> {
  private final Provider<ApiServiceProvider> apiServiceProvider;

  public TimeRepository_Factory(Provider<ApiServiceProvider> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public TimeRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static TimeRepository_Factory create(Provider<ApiServiceProvider> apiServiceProvider) {
    return new TimeRepository_Factory(apiServiceProvider);
  }

  public static TimeRepository newInstance(ApiServiceProvider apiServiceProvider) {
    return new TimeRepository(apiServiceProvider);
  }
}
