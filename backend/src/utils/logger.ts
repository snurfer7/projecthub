type LogLevel = 'INFO' | 'WARN' | 'ERROR';

class Logger {
    private formatMessage(level: LogLevel, message: string, detail?: any): string {
        const timestamp = new Date().toISOString();
        const detailStr = detail ? ` - ${JSON.stringify(detail)}` : '';
        return `[${timestamp}] [${level}] ${message}${detailStr}`;
    }

    info(message: string, detail?: any) {
        console.log(this.formatMessage('INFO', message, detail));
    }

    warn(message: string, detail?: any) {
        console.warn(this.formatMessage('WARN', message, detail));
    }

    error(message: string, error?: any) {
        const detail = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        console.error(this.formatMessage('ERROR', message, detail));
    }
}

export const logger = new Logger();
