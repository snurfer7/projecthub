package com.projecthub.android.ui.kanban;

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
public final class KanbanViewModel_Factory implements Factory<KanbanViewModel> {
  private final Provider<IssueRepository> issueRepositoryProvider;

  public KanbanViewModel_Factory(Provider<IssueRepository> issueRepositoryProvider) {
    this.issueRepositoryProvider = issueRepositoryProvider;
  }

  @Override
  public KanbanViewModel get() {
    return newInstance(issueRepositoryProvider.get());
  }

  public static KanbanViewModel_Factory create(Provider<IssueRepository> issueRepositoryProvider) {
    return new KanbanViewModel_Factory(issueRepositoryProvider);
  }

  public static KanbanViewModel newInstance(IssueRepository issueRepository) {
    return new KanbanViewModel(issueRepository);
  }
}
