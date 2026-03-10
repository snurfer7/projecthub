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
