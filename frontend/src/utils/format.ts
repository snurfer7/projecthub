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
