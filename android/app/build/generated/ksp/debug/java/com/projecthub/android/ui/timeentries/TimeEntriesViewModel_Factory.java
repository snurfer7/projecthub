package com.projecthub.android.ui.timeentries;

import com.projecthub.android.data.repository.TimeRepository;
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
public final class TimeEntriesViewModel_Factory implements Factory<TimeEntriesViewModel> {
  private final Provider<TimeRepository> timeRepositoryProvider;

  public TimeEntriesViewModel_Factory(Provider<TimeRepository> timeRepositoryProvider) {
    this.timeRepositoryProvider = timeRepositoryProvider;
  }

  @Override
  public TimeEntriesViewModel get() {
    return newInstance(timeRepositoryProvider.get());
  }

  public static TimeEntriesViewModel_Factory create(
      Provider<TimeRepository> timeRepositoryProvider) {
    return new TimeEntriesViewModel_Factory(timeRepositoryProvider);
  }

  public static TimeEntriesViewModel newInstance(TimeRepository timeRepository) {
    return new TimeEntriesViewModel(timeRepository);
  }
}
