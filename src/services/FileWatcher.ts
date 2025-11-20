import * as vscode from 'vscode';
import { LoggingService } from './LoggingService';

/**
 * Callback type for file events
 */
export type FileChangeCallback = (uri: vscode.Uri) => void;
export type WorkspaceChangeCallback = () => void;
export type ConfigurationChangeCallback = (event: vscode.ConfigurationChangeEvent) => void;

/**
 * File and workspace change monitoring service
 * 
 * Responsibilities:
 * - Monitor PHP files for changes/creation/deletion
 * - Detect VS Code configuration changes
 * - Handle workspace folder changes
 * - Centralize all watchers and their callbacks
 * - Automatic resource cleanup
 */
export class FileWatcher {
    private phpFileWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    
    constructor(private logger: LoggingService) {}

    /**
     * Initialize PHP file monitoring
     * @param onFileChange Callback for file changes (create/change/delete)
     */
    watchPhpFiles(onFileChange: FileChangeCallback): void {
        this.logger.logInfo('🔍 Initializing PHP file monitoring...');

        // Create watcher for PHP files
        this.phpFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.php');
        
        // Configure callbacks for all event types
        this.phpFileWatcher.onDidCreate((uri) => {
            this.logger.logDebug(`📁 PHP file created: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.phpFileWatcher.onDidChange((uri) => {
            this.logger.logDebug(`📝 PHP file modified: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.phpFileWatcher.onDidDelete((uri) => {
            this.logger.logDebug(`🗑️ PHP file deleted: ${uri.fsPath}`);
            onFileChange(uri);
        });

        this.logger.logSuccess('✅ PHP file monitoring enabled');
    }

    /**
     * Monitor workspace folder changes
     * @param onWorkspaceChange Callback for workspace changes
     */
    watchWorkspaceFolders(onWorkspaceChange: WorkspaceChangeCallback): void {
        this.logger.logInfo('🏗️ Initializing workspace folder monitoring...');

        const disposable = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
            this.logger.logInfo(`📂 Workspace folders changed: +${event.added.length} -${event.removed.length}`);
            
            // Detailed logging of changes
            for (const added of event.added) {
                this.logger.logDebug(`➕ Folder added: ${added.uri.fsPath}`);
            }
            for (const removed of event.removed) {
                this.logger.logDebug(`➖ Folder removed: ${removed.uri.fsPath}`);
            }

            onWorkspaceChange();
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Workspace folder monitoring enabled');
    }

    /**
     * Monitor VS Code configuration changes
     * @param onConfigChange Callback for configuration changes
     * @param configurationSection Specific section to monitor (optional)
     */
    watchConfiguration(onConfigChange: ConfigurationChangeCallback, configurationSection?: string): void {
        this.logger.logInfo(`⚙️ Initializing configuration monitoring${configurationSection ? ` (${configurationSection})` : ''}...`);

        const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
            // Filter by section if specified
            if (configurationSection && !event.affectsConfiguration(configurationSection)) {
                return;
            }

            this.logger.logInfo(`⚙️ Configuration changed${configurationSection ? ` in ${configurationSection}` : ''}`);
            onConfigChange(event);
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Configuration monitoring enabled');
    }

    /**
     * Monitor VS Code terminal close events
     * @param onTerminalClose Callback for terminal closure
     */
    watchTerminalClose(onTerminalClose: () => void): void {
        this.logger.logInfo('🖥️ Initializing terminal monitoring...');

        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
            this.logger.logDebug(`🖥️ Terminal closed: ${terminal.name || 'unnamed'}`);
            onTerminalClose();
        });

        this.disposables.push(disposable);
        this.logger.logSuccess('✅ Terminal monitoring enabled');
    }

    /**
     * Enable all monitoring with provided callbacks
     * @param callbacks Object containing all necessary callbacks
     */
    watchAll(callbacks: {
        onFileChange: FileChangeCallback;
        onWorkspaceChange: WorkspaceChangeCallback;
        onConfigChange: ConfigurationChangeCallback;
        onTerminalClose: () => void;
        configurationSection?: string;
    }): void {
        this.logger.logInfo('🚀 Initializing complete monitoring...');

        this.watchPhpFiles(callbacks.onFileChange);
        this.watchWorkspaceFolders(callbacks.onWorkspaceChange);
        this.watchConfiguration(callbacks.onConfigChange, callbacks.configurationSection);
        this.watchTerminalClose(callbacks.onTerminalClose);

        this.logger.logSuccess('✅ All monitoring systems are active');
    }

    /**
     * Temporarily disable PHP file monitoring
     */
    pausePhpFileWatching(): void {
        if (this.phpFileWatcher) {
            this.phpFileWatcher.dispose();
            this.phpFileWatcher = undefined;
            this.logger.logInfo('⏸️ PHP file monitoring paused');
        }
    }

    /**
     * Resume PHP file monitoring
     * @param onFileChange Callback for changes
     */
    resumePhpFileWatching(onFileChange: FileChangeCallback): void {
        if (!this.phpFileWatcher) {
            this.watchPhpFiles(onFileChange);
            this.logger.logInfo('▶️ PHP file monitoring resumed');
        }
    }

    /**
     * Check if PHP monitoring is active
     */
    isPhpWatchingActive(): boolean {
        return this.phpFileWatcher !== undefined;
    }

    /**
     * Get monitoring statistics
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
     * Cleanup all monitoring and resources
     */
    dispose(): void {
        this.logger.logInfo('🧹 Cleaning up FileWatcher...');

        // Dispose PHP file watcher
        if (this.phpFileWatcher) {
            this.phpFileWatcher.dispose();
            this.phpFileWatcher = undefined;
            this.logger.logDebug('🗑️ PHP FileSystemWatcher disposed');
        }

        // Dispose all other disposables
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];

        this.logger.logSuccess('✅ FileWatcher cleaned up successfully');
    }
}