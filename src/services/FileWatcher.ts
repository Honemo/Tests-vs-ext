import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';

/**
 * Type de callback pour les événements de fichier
 */
export type FileChangeCallback = (uri: vscode.Uri) => void;
export type WorkspaceChangeCallback = () => void;
export type ConfigurationChangeCallback = (event: vscode.ConfigurationChangeEvent) => void;

/**
 * Service de surveillance des fichiers et changements workspace
 * 
 * Responsabilités:
 * - Surveiller les fichiers PHP pour changements/créations/suppressions
 * - Détecter les changements de configuration VS Code
 * - Gérer les changements de workspace folders
 * - Centraliser tous les watchers et leurs callbacks
 * - Cleanup automatique des ressources
 */
export class FileWatcher {
    private phpFileWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    
    constructor(private logger: LoggingService) {}

    /**
     * Initialise la surveillance des fichiers PHP
     * @param onFileChange Callback pour les changements de fichiers (create/change/delete)
     */
    watchPhpFiles(onFileChange: FileChangeCallback): void {
        this.logger.logInfo('🔍 Initialisation surveillance fichiers PHP...');

        // Créer le watcher pour les fichiers PHP
        this.phpFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.php');
        
        // Configurer les callbacks pour tous les types d'événements
        this.phpFileWatcher.onDidCreate((uri) => {
            this.logger.logDebug(`📁 Fichier PHP créé: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.phpFileWatcher.onDidChange((uri) => {
            this.logger.logDebug(`📝 Fichier PHP modifié: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.phpFileWatcher.onDidDelete((uri) => {
            this.logger.logDebug(`🗑️ Fichier PHP supprimé: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.logger.logSuccess('✅ Surveillance fichiers PHP activée');
    }

    /**
     * Surveille les changements de workspace folders
     * @param onWorkspaceChange Callback pour les changements de workspace
     */
    watchWorkspaceFolders(onWorkspaceChange: WorkspaceChangeCallback): void {
        this.logger.logInfo('🏗️ Initialisation surveillance workspace folders...');

        const disposable = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
            this.logger.logInfo(`📂 Workspace folders changés: +${event.added.length} -${event.removed.length}`);
            
            // Log détaillé des changements
            for (const added of event.added) {
                this.logger.logDebug(`➕ Folder ajouté: ${added.uri.fsPath}`);
            }
            for (const removed of event.removed) {
                this.logger.logDebug(`➖ Folder supprimé: ${removed.uri.fsPath}`);
            }

            onWorkspaceChange();
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Surveillance workspace folders activée');
    }

    /**
     * Surveille les changements de configuration VS Code
     * @param onConfigChange Callback pour les changements de configuration
     * @param configurationSection Section spécifique à surveiller (optionnel)
     */
    watchConfiguration(onConfigChange: ConfigurationChangeCallback, configurationSection?: string): void {
        this.logger.logInfo(`⚙️ Initialisation surveillance configuration${configurationSection ? ` (${configurationSection})` : ''}...`);

        const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
            // Filtrer par section si spécifiée
            if (configurationSection && !event.affectsConfiguration(configurationSection)) {
                return;
            }

            this.logger.logInfo(`⚙️ Configuration changée${configurationSection ? ` dans ${configurationSection}` : ''}`);
            onConfigChange(event);
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Surveillance configuration activée');
    }

    /**
     * Surveille la fermeture des terminaux VS Code
     * @param onTerminalClose Callback pour la fermeture de terminal
     */
    watchTerminalClose(onTerminalClose: () => void): void {
        this.logger.logInfo('🖥️ Initialisation surveillance terminaux...');

        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
            this.logger.logDebug(`🖥️ Terminal fermé: ${terminal.name || 'sans nom'}`);
            onTerminalClose();
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Surveillance terminaux activée');
    }

    /**
     * Active toutes les surveillances avec les callbacks fournis
     * @param callbacks Objet contenant tous les callbacks nécessaires
     */
    watchAll(callbacks: {
        onFileChange: FileChangeCallback;
        onWorkspaceChange: WorkspaceChangeCallback;
        onConfigChange: ConfigurationChangeCallback;
        onTerminalClose: () => void;
        configurationSection?: string;
    }): void {
        this.logger.logInfo('🚀 Initialisation complète de la surveillance...');

        this.watchPhpFiles(callbacks.onFileChange);
        this.watchWorkspaceFolders(callbacks.onWorkspaceChange);
        this.watchConfiguration(callbacks.onConfigChange, callbacks.configurationSection);
        this.watchTerminalClose(callbacks.onTerminalClose);

        this.logger.logSuccess('✅ Toutes les surveillances sont actives');
    }

    /**
     * Désactive temporairement la surveillance des fichiers PHP
     */
    pausePhpFileWatching(): void {
        if (this.phpFileWatcher) {
            this.phpFileWatcher.dispose();
            this.phpFileWatcher = undefined;
            this.logger.logInfo('⏸️ Surveillance fichiers PHP mise en pause');
        }
    }

    /**
     * Réactive la surveillance des fichiers PHP
     * @param onFileChange Callback pour les changements
     */
    resumePhpFileWatching(onFileChange: FileChangeCallback): void {
        if (!this.phpFileWatcher) {
            this.watchPhpFiles(onFileChange);
            this.logger.logInfo('▶️ Surveillance fichiers PHP reprise');
        }
    }

    /**
     * Vérifie si la surveillance PHP est active
     */
    isPhpWatchingActive(): boolean {
        return this.phpFileWatcher !== undefined;
    }

    /**
     * Obtient les statistiques de surveillance
     */
    getWatchingStats(): {
        phpWatcherActive: boolean;
        totalDisposables: number;
    } {
        return {
            phpWatcherActive: this.isPhpWatchingActive(),
            totalDisposables: this.disposables.length
        };
    }

    /**
     * Nettoyage de toutes les surveillances et ressources
     */
    dispose(): void {
        this.logger.logInfo('🧹 Nettoyage FileWatcher...');

        // Disposer du watcher de fichiers PHP
        if (this.phpFileWatcher) {
            this.phpFileWatcher.dispose();
            this.phpFileWatcher = undefined;
            this.logger.logDebug('🗑️ PHP FileSystemWatcher disposé');
        }

        // Disposer de tous les autres disposables
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];

        this.logger.logSuccess('✅ FileWatcher nettoyé avec succès');
    }
}