import type { CompanyTransactionType } from './format';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export const COMPANIES_LIST_STORAGE_KEY = 'projecthub.companiesList.v1';

export const COMPANIES_LIST_RESET_EVENT = 'projecthub:companies-list-reset';

export type CompaniesListQuery = {
  page: number;
  pageSize: number;
  q: string;
  transactionTypes: CompanyTransactionType[];
};

export type PersistedCompaniesList = {
  v: 1;
  searchQuery: string;
  listQuery: CompaniesListQuery & { filterSales?: boolean; filterPurchase?: boolean };
  showLegalEntity: boolean;
};

export function defaultCompaniesListQuery(): CompaniesListQuery {
  return { page: 1, pageSize: 50, q: '', transactionTypes: [] };
}

function isPageSize(n: number): n is (typeof PAGE_SIZE_OPTIONS)[number] {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

function parseTransactionTypes(listQuery: PersistedCompaniesList['listQuery']): CompanyTransactionType[] {
  if (Array.isArray(listQuery.transactionTypes)) {
    return listQuery.transactionTypes.filter((v): v is CompanyTransactionType => v === 'sales' || v === 'purchase');
  }
  const fromLegacy: CompanyTransactionType[] = [];
  if (listQuery.filterSales) fromLegacy.push('sales');
  if (listQuery.filterPurchase) fromLegacy.push('purchase');
  return fromLegacy;
}

export function readPersistedCompaniesList(): Omit<PersistedCompaniesList, 'v'> | null {
  try {
    const raw = sessionStorage.getItem(COMPANIES_LIST_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PersistedCompaniesList;
    if (o?.v !== 1 || !o.listQuery) return null;
    const { page, pageSize, q } = o.listQuery;
    if (typeof page !== 'number' || page < 1 || typeof q !== 'string') return null;
    if (!isPageSize(pageSize)) return null;
    if (typeof o.searchQuery !== 'string') return null;
    if (typeof o.showLegalEntity !== 'boolean') return null;
    return {
      searchQuery: o.searchQuery,
      listQuery: { page, pageSize, q, transactionTypes: parseTransactionTypes(o.listQuery) },
      showLegalEntity: o.showLegalEntity,
    };
  } catch {
    return null;
  }
}

/** ヘッダー「企業」から一覧へ入るとき: 保存を消し、既に一覧表示中なら UI も初期化する */
export function clearCompaniesListPersistedFromHeader(): void {
  try {
    sessionStorage.removeItem(COMPANIES_LIST_STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(COMPANIES_LIST_RESET_EVENT));
}
