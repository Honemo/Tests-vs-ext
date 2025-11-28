import * as vscode from 'vscode';
import { LogLevel, LogLevelValues } from '../types';

/**
 * Centralized logging service for PHP Test Collections Explorer
 * 
 * Manages log display in VS Code's dedicated Output tab
 * with formatting, automatic timestamps and configurable logging levels.
 */
export class LoggingService {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly errorOutputChannel: vscode.OutputChannel;
    private readonly channelName = 'PHP Test Collections';
    private readonly errorChannelName = 'PHP Test Details';
    private currentLevel: LogLevel;
    private configWatcher: vscode.Disposable;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.channelName);
        this.errorOutputChannel = vscode.window.createOutputChannel(this.errorChannelName);
        
        // Initialize logging level from configuration
        this.currentLevel = this.getConfiguredLevel();
        
        // Watch for configuration changes
        this.configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('phpTestCollections.logLevel')) {
                this.currentLevel = this.getConfiguredLevel();
                this.log('📝 Log level updated to: ' + this.currentLevel);
            }
        });

        this.log('🚀 Logging service initialized');
    }

    /**
     * Get the configured logging level from VS Code settings
     */
    private getConfiguredLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        const levelString = config.get<string>('logLevel', 'info');
        
        // Validate and convert string to LogLevel enum
        if (Object.values(LogLevel).includes(levelString as LogLevel)) {
            return levelString as LogLevel;
        }
        
        return LogLevel.Info; // Default fallback
    }

    /**
     * Check if a message should be logged based on current level
     */
    private shouldLog(messageLevel: LogLevel): boolean {
        return LogLevelValues[messageLevel] <= LogLevelValues[this.currentLevel];
    }

    /**
     * Log a simple message with timestamp
     * @param message Message to log
     */
    log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Log a command with special formatting
     * @param context Command execution context
     * @param command Command to execute
     */
    logCommand(context: string, command: string): void {
        if (!this.shouldLog(LogLevel.Info)) return;
        
        this.log(`📝 ${context}`);
        this.log(`   Command: ${command}`);
        this.log(''); // Empty line for readability
    }

    /**
     * Log an error message with special formatting
     * @param message Error message
     * @param error Optional error with stack trace
     */
    logError(message: string, error?: Error): void {
        if (!this.shouldLog(LogLevel.Error)) return;
        
        this.log(`❌ ERROR: ${message}`);
        if (error) {
            this.log(`   Message: ${error.message}`);
            if (error.stack) {
                this.log(`   Stack: ${error.stack}`);
            }
        }
        this.log('');
    }

	logErrorDetails(message: string): void {
		this.errorOutputChannel.clear();
		// this.errorOutputChannel.
		this.errorOutputChannel.append(message);
		this.errorOutputChannel.show();
	}

    /**
     * Log a debug message (used for development)
     * @param message Debug message
     */
    logDebug(message: string): void {
        if (!this.shouldLog(LogLevel.Debug)) return;
        
        this.log(`🔍 DEBUG: ${message}`);
    }

    /**
     * Log an information message with special formatting
     * @param message Information message
     */
    logInfo(message: string): void {
        if (!this.shouldLog(LogLevel.Info)) return;
        
        this.log(`ℹ️ INFO: ${message}`);
    }

    /**
     * Log a success message
     * @param message Success message
     */
    logSuccess(message: string): void {
        if (!this.shouldLog(LogLevel.Debug)) return;
        
        this.log(`✅ ${message}`);
    }

    /**
     * Log a warning message
     * @param message Warning message
     */
    logWarning(message: string): void {
        if (!this.shouldLog(LogLevel.Warn)) return;
        
        this.log(`⚠️ WARNING: ${message}`);
    }

    /**
     * Get the current logging level
     */
    getCurrentLevel(): LogLevel {
        return this.currentLevel;
    }

    /**
     * Add an empty line for readability
     */
    logSeparator(): void {
        this.outputChannel.appendLine('');
    }

    /**
     * Show the Output tab
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Clear the Output content
     */
    clear(): void {
        this.outputChannel.clear();
        this.log('📋 Logs cleared');
    }

    /**
     * Release resources
     */
    dispose(): void {
        this.configWatcher?.dispose();
        this.outputChannel.dispose();
    }
}