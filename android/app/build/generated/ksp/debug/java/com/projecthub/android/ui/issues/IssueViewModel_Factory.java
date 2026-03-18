package com.projecthub.android.ui.issues;

import com.projecthub.android.data.repository.IssueRepository;
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
public final class IssueViewModel_Factory implements Factory<IssueViewModel> {
  private final Provider<IssueRepository> issueRepositoryProvider;

  public IssueViewModel_Factory(Provider<IssueRepository> issueRepositoryProvider) {
    this.issueRepositoryProvider = issueRepositoryProvider;
  }

  @Override
  public IssueViewModel get() {
    return newInstance(issueRepositoryProvider.get());
  }

  public static IssueViewModel_Factory create(Provider<IssueRepository> issueRepositoryProvider) {
    return new IssueViewModel_Factory(issueRepositoryProvider);
  }

  public static IssueViewModel newInstance(IssueRepository issueRepository) {
    return new IssueViewModel(issueRepository);
  }
}
