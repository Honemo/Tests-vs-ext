import * as vscode from 'vscode';
import { LogLevel, LogLevelValues } from '../types';

/**
 * Service de logging centralisé pour PHP Test Collections Explorer
 * 
 * Gère l'affichage des logs dans l'onglet Output dédié de VS Code
 * avec formatage, timestamps automatiques et niveaux de logging configurables.
 */
export class LoggingService {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly channelName = 'PHP Test Collections';
    private currentLevel: LogLevel;
    private configWatcher: vscode.Disposable;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.channelName);
        
        // Initialize logging level from configuration
        this.currentLevel = this.getConfiguredLevel();
        
        // Watch for configuration changes
        this.configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('phpTestCollections.logLevel')) {
                this.currentLevel = this.getConfiguredLevel();
                this.log('📝 Log level updated to: ' + this.currentLevel);
            }
        });

        this.log('🚀 Service de logging initialisé');
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
     * Log un message simple avec timestamp
     * @param message Message à logger
     */
    log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Log une commande avec mise en forme spéciale
     * @param context Contexte de l'exécution de la commande
     * @param command Commande à exécuter
     */
    logCommand(context: string, command: string): void {
        if (!this.shouldLog(LogLevel.Info)) return;
        
        this.log(`📝 ${context}`);
        this.log(`   Commande: ${command}`);
        this.log(''); // Ligne vide pour la lisibilité
    }

    /**
     * Log un message d'erreur avec formatage spécial
     * @param message Message d'erreur
     * @param error Erreur optionnelle avec stack trace
     */
    logError(message: string, error?: Error): void {
        if (!this.shouldLog(LogLevel.Error)) return;
        
        this.log(`❌ ERREUR: ${message}`);
        if (error) {
            this.log(`   Message: ${error.message}`);
            if (error.stack) {
                this.log(`   Stack: ${error.stack}`);
            }
        }
        this.log('');
    }

    /**
     * Log un message de debug (utilisé pour le développement)
     * @param message Message de debug
     */
    logDebug(message: string): void {
        if (!this.shouldLog(LogLevel.Debug)) return;
        
        this.log(`🔍 DEBUG: ${message}`);
    }

    /**
     * Log un message d'information avec formatage spécial
     * @param message Message d'information
     */
    logInfo(message: string): void {
        if (!this.shouldLog(LogLevel.Info)) return;
        
        this.log(`ℹ️ INFO: ${message}`);
    }

    /**
     * Log un message de succès
     * @param message Message de succès
     */
    logSuccess(message: string): void {
        if (!this.shouldLog(LogLevel.Info)) return;
        
        this.log(`✅ ${message}`);
    }

    /**
     * Log un message d'avertissement
     * @param message Message d'avertissement
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
     * Ajouter une ligne vide pour la lisibilité
     */
    logSeparator(): void {
        this.outputChannel.appendLine('');
    }

    /**
     * Afficher l'onglet Output
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Effacer le contenu de l'Output
     */
    clear(): void {
        this.outputChannel.clear();
        this.log('📋 Logs effacés');
    }

    /**
     * Libérer les ressources
     */
    dispose(): void {
        this.configWatcher?.dispose();
        this.outputChannel.dispose();
    }
}