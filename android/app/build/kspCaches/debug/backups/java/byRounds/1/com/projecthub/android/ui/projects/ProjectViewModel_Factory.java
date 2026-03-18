package com.projecthub.android.ui.projects;

import com.projecthub.android.data.repository.CompanyRepository;
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

  private final Provider<CompanyRepository> companyRepositoryProvider;

  public ProjectViewModel_Factory(Provider<ProjectRepository> projectRepositoryProvider,
      Provider<CompanyRepository> companyRepositoryProvider) {
    this.projectRepositoryProvider = projectRepositoryProvider;
    this.companyRepositoryProvider = companyRepositoryProvider;
  }

  @Override
  public ProjectViewModel get() {
    return newInstance(projectRepositoryProvider.get(), companyRepositoryProvider.get());
  }

  public static ProjectViewModel_Factory create(
      Provider<ProjectRepository> projectRepositoryProvider,
      Provider<CompanyRepository> companyRepositoryProvider) {
    return new ProjectViewModel_Factory(projectRepositoryProvider, companyRepositoryProvider);
  }

  public static ProjectViewModel newInstance(ProjectRepository projectRepository,
      CompanyRepository companyRepository) {
    return new ProjectViewModel(projectRepository, companyRepository);
  }
}
