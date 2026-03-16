package com.projecthub.android.ui.home;

import com.projecthub.android.data.local.PreferencesManager;
import com.projecthub.android.data.repository.IssueRepository;
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
public final class HomeViewModel_Factory implements Factory<HomeViewModel> {
  private final Provider<ProjectRepository> projectRepositoryProvider;

  private final Provider<IssueRepository> issueRepositoryProvider;

  private final Provider<PreferencesManager> preferencesManagerProvider;

  public HomeViewModel_Factory(Provider<ProjectRepository> projectRepositoryProvider,
      Provider<IssueRepository> issueRepositoryProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    this.projectRepositoryProvider = projectRepositoryProvider;
    this.issueRepositoryProvider = issueRepositoryProvider;
    this.preferencesManagerProvider = preferencesManagerProvider;
  }

  @Override
  public HomeViewModel get() {
    return newInstance(projectRepositoryProvider.get(), issueRepositoryProvider.get(), preferencesManagerProvider.get());
  }

  public static HomeViewModel_Factory create(Provider<ProjectRepository> projectRepositoryProvider,
      Provider<IssueRepository> issueRepositoryProvider,
      Provider<PreferencesManager> preferencesManagerProvider) {
    return new HomeViewModel_Factory(projectRepositoryProvider, issueRepositoryProvider, preferencesManagerProvider);
  }

  public static HomeViewModel newInstance(ProjectRepository projectRepository,
      IssueRepository issueRepository, PreferencesManager preferencesManager) {
    return new HomeViewModel(projectRepository, issueRepository, preferencesManager);
  }
}
