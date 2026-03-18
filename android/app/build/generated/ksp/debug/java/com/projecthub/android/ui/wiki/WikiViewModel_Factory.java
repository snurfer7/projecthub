package com.projecthub.android.ui.wiki;

import com.projecthub.android.data.repository.ProjectRepository;
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
public final class WikiViewModel_Factory implements Factory<WikiViewModel> {
  private final Provider<ProjectRepository> projectRepositoryProvider;

  public WikiViewModel_Factory(Provider<ProjectRepository> projectRepositoryProvider) {
    this.projectRepositoryProvider = projectRepositoryProvider;
  }

  @Override
  public WikiViewModel get() {
    return newInstance(projectRepositoryProvider.get());
  }

  public static WikiViewModel_Factory create(
      Provider<ProjectRepository> projectRepositoryProvider) {
    return new WikiViewModel_Factory(projectRepositoryProvider);
  }

  public static WikiViewModel newInstance(ProjectRepository projectRepository) {
    return new WikiViewModel(projectRepository);
  }
}
