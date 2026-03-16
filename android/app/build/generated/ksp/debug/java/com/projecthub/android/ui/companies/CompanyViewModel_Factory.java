package com.projecthub.android.ui.companies;

import com.projecthub.android.data.repository.CompanyRepository;
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
public final class CompanyViewModel_Factory implements Factory<CompanyViewModel> {
  private final Provider<CompanyRepository> companyRepositoryProvider;

  public CompanyViewModel_Factory(Provider<CompanyRepository> companyRepositoryProvider) {
    this.companyRepositoryProvider = companyRepositoryProvider;
  }

  @Override
  public CompanyViewModel get() {
    return newInstance(companyRepositoryProvider.get());
  }

  public static CompanyViewModel_Factory create(
      Provider<CompanyRepository> companyRepositoryProvider) {
    return new CompanyViewModel_Factory(companyRepositoryProvider);
  }

  public static CompanyViewModel newInstance(CompanyRepository companyRepository) {
    return new CompanyViewModel(companyRepository);
  }
}
