import * as vscode from 'vscode';

/**
 * Service de logging centralisé pour PHP Test Collections Explorer
 * 
 * Gère l'affichage des logs dans l'onglet Output dédié de VS Code
 * avec formatage et timestamps automatiques.
 */
export class LoggingService {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly channelName = 'PHP Test Collections';

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.channelName);
        this.log('🚀 Service de logging initialisé');
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
        this.log(`🔍 DEBUG: ${message}`);
    }

    /**
     * Log un message d'information avec formatage spécial
     * @param message Message d'information
     */
    logInfo(message: string): void {
        this.log(`ℹ️ INFO: ${message}`);
    }

    /**
     * Log un message de succès
     * @param message Message de succès
     */
    logSuccess(message: string): void {
        this.log(`✅ ${message}`);
    }

    /**
     * Log un message d'avertissement
     * @param message Message d'avertissement
     */
    logWarning(message: string): void {
        this.log(`⚠️ WARNING: ${message}`);
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
        this.outputChannel.dispose();
    }
}