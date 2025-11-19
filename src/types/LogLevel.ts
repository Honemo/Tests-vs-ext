/**
 * Available logging levels for filtering output
 */
export enum LogLevel {
    Error = 'error',
    Warn = 'warn', 
    Info = 'info',
    Debug = 'debug'
}

/**
 * Numeric values for level comparison
 */
export const LogLevelValues: Record<LogLevel, number> = {
    [LogLevel.Error]: 0,
    [LogLevel.Warn]: 1,
    [LogLevel.Info]: 2,
    [LogLevel.Debug]: 3
};