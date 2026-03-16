package com.projecthub.android.ui.projects;

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
public final class ProjectViewModel_Factory implements Factory<ProjectViewModel> {
  private final Provider<ProjectRepository> projectRepositoryProvider;

  public ProjectViewModel_Factory(Provider<ProjectRepository> projectRepositoryProvider) {
    this.projectRepositoryProvider = projectRepositoryProvider;
  }

  @Override
  public ProjectViewModel get() {
    return newInstance(projectRepositoryProvider.get());
  }

  public static ProjectViewModel_Factory create(
      Provider<ProjectRepository> projectRepositoryProvider) {
    return new ProjectViewModel_Factory(projectRepositoryProvider);
  }

  public static ProjectViewModel newInstance(ProjectRepository projectRepository) {
    return new ProjectViewModel(projectRepository);
  }
}
