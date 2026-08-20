/**
 * Formats estimated hours into a "days and hours" string based on total day conversion.
 * Example: hours=43, totalDayConversion=8 => "(5d3h)"
 */
export function formatEstimatedHours(hours: number | null | undefined, totalDayConversion: number): string {
    if (hours === null || hours === undefined || hours <= 0 || totalDayConversion <= 0) {
        return '';
    }

    const days = Math.floor(hours / totalDayConversion);
    const remainingHours = Math.round((hours % totalDayConversion) * 10) / 10;

    if (days === 0) {
        return `(${remainingHours}h)`;
    }

    if (remainingHours === 0) {
        return `(${days}d)`;
    }

    return `(${days}d${remainingHours}h)`;
}

/**
 * Formats company name with legal entity status based on position.
 * Example: name="Google", status="株式会社", position="前" => "株式会社　Google"
 */
export function formatCompanyName(company: { name: string, legalEntityStatus?: { name: string } | null, legalEntityPosition?: string | null }): string {
    const statusName = company.legalEntityStatus?.name;
    if (!statusName || !company.legalEntityPosition) {
        return company.name;
    }

    if (company.legalEntityPosition === '前') {
        return `${statusName}　${company.name}`;
    } else if (company.legalEntityPosition === '後') {
        return `${company.name}　${statusName}`;
    }

    return company.name;
}

export const COMPANY_TRANSACTION_TYPE_OPTIONS = [
    { value: 'sales', label: '売上先' },
    { value: 'purchase', label: '仕入先' },
] as const;

export type CompanyTransactionType = (typeof COMPANY_TRANSACTION_TYPE_OPTIONS)[number]['value'];

/** 登録・編集モーダル用の排他トグル（売上 / 仕入 / 売上・仕入） */
export const COMPANY_TRANSACTION_MODE_OPTIONS = [
    { value: 'sales', label: '売上' },
    { value: 'purchase', label: '仕入' },
    { value: 'both', label: '売上・仕入' },
] as const;

export type CompanyTransactionMode = (typeof COMPANY_TRANSACTION_MODE_OPTIONS)[number]['value'];

export function companyTransactionTypeValues(company: {
    isSales?: boolean;
    isPurchase?: boolean;
}): CompanyTransactionType[] {
    const values: CompanyTransactionType[] = [];
    if (company.isSales) values.push('sales');
    if (company.isPurchase) values.push('purchase');
    return values;
}

export function companyFlagsFromTransactionTypes(values: Array<string | number>): {
    isSales: boolean;
    isPurchase: boolean;
} {
    const set = new Set(values.map((v) => String(v)));
    return { isSales: set.has('sales'), isPurchase: set.has('purchase') };
}

/** 未設定・売上のみは sales。仕入のみは purchase。両方は both */
export function companyTransactionModeFromFlags(company: {
    isSales?: boolean;
    isPurchase?: boolean;
}): CompanyTransactionMode {
    if (company.isSales && company.isPurchase) return 'both';
    if (company.isPurchase) return 'purchase';
    return 'sales';
}

export function companyFlagsFromTransactionMode(mode: CompanyTransactionMode): {
    isSales: boolean;
    isPurchase: boolean;
} {
    if (mode === 'purchase') return { isSales: false, isPurchase: true };
    if (mode === 'both') return { isSales: true, isPurchase: true };
    return { isSales: true, isPurchase: false };
}

/** 取引区分の表示（売上 / 仕入 / 売上・仕入） */
export function formatCompanyTransactionTypes(
    company: { isSales?: boolean; isPurchase?: boolean },
    empty = '-',
): string {
    if (company.isSales && company.isPurchase) return '売上・仕入';
    if (company.isSales) return '売上';
    if (company.isPurchase) return '仕入';
    return empty;
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 */
export function formatDateToYYYYMMDD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Converts full-width alphanumeric and symbols to half-width.
 */
export function convertToHalfWidth(str: string): string {
    if (!str) return str;
    return str.replace(/[！-～]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    }).replace(/　/g, ' ');
}

/**
 * Formats a postal code as 000-0000.
 * If the input already has a hyphen or non-digit characters, it cleans and reformats them.
 */
export function formatPostalCode(value: string): string {
    const halfWidth = convertToHalfWidth(value);
    const numbers = halfWidth.replace(/\D/g, '');
    if (numbers.length <= 3) {
        return numbers;
    }
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}`;
}

/**
 * Generates a random project identifier of the given length using [a-z0-9].
 * Default length is 12. With 36^12 ≈ 4.7e18 combinations, collisions are negligible.
 */
export function generateIdentifier(length = 12): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join('');
}

/** 連絡先の氏名（姓・名）。名が空のときは姓のみ。両方空なら「-」。 */
export function formatContactDisplayName(lastName: string, firstName: string): string {
    const last = (lastName ?? '').trim();
    const first = (firstName ?? '').trim();
    const parts = [last, first].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
}
