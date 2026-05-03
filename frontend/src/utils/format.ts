/**
 * Formats estimated hours into a "days and hours" string based on total day conversion.
 * Example: hours=43, totalDayConversion=8 => "(5d3h)"
 */
export function formatEstimatedHours(hours: number | null | undefined, totalDayConversion: number): string {
    if (hours === null || hours === undefined || hours <= 0 || totalDayConversion <= 0) {
        return '';
    }

    const days = Math.floor(hours / totalDayConversion);
    const remainingHours = hours % totalDayConversion;

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

/** 連絡先の氏名（姓・名）。名が空のときは姓のみ。両方空なら「-」。 */
export function formatContactDisplayName(lastName: string, firstName: string): string {
    const last = (lastName ?? '').trim();
    const first = (firstName ?? '').trim();
    const parts = [last, first].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
}
