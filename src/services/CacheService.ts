import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CachedCollection, JsonCacheData } from '../types';
import { LoggingService } from './LoggingService';

/**
 * Service de gestion du cache JSON pour PHP Test Collections Explorer
 * 
 * Gère la persistance des données de test dans des fichiers JSON
 * avec support workspace-spécifique et gestion .gitignore automatique.
 */
export class CacheService {
    private cacheFilePath: string = '';
    private readonly context: vscode.ExtensionContext;
    private readonly logger: LoggingService;

    constructor(context: vscode.ExtensionContext, logger: LoggingService) {
        this.context = context;
        this.logger = logger;
        this.initializeCachePath();
    }

    /**
     * Obtient le chemin du fichier de cache
     */
    getCacheFilePath(): string {
        return this.cacheFilePath;
    }

    /**
     * Initialise le chemin du cache basé sur le workspace actuel
     */
    private initializeCachePath(): void {
        let cacheFileName = 'php-test-collections-cache.json';
        
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            
            // Créer un nom de fichier unique pour chaque workspace
            if (vscode.workspace.workspaceFolders.length > 1) {
                const workspaceNames = vscode.workspace.workspaceFolders
                    .map(folder => path.basename(folder.uri.fsPath))
                    .join('-');
                cacheFileName = `php-test-collections-cache-${workspaceNames}.json`;
            }
            
            // Ajouter l'identifiant du workspace si disponible
            if (vscode.workspace.name) {
                const safeName = vscode.workspace.name.replace(/[^a-zA-Z0-9-_]/g, '-');
                cacheFileName = `php-test-collections-cache-${safeName}.json`;
            }
            
            this.cacheFilePath = path.join(workspaceRoot, '.vscode', cacheFileName);
            
            console.log(`Cache initialisé pour le workspace: ${this.cacheFilePath}`);
            this.logger.logInfo(`Cache initialisé: ${this.cacheFilePath}`);
        } else {
            // Fallback vers le stockage global de l'extension si pas de workspace
            this.cacheFilePath = path.join(this.context.globalStorageUri.fsPath, cacheFileName);
        }
    }

    /**
     * Force le rafraîchissement en supprimant le cache
     */
    async forceRefresh(): Promise<void> {
        // Supprimer le fichier de cache
        if (this.cacheFilePath && fs.existsSync(this.cacheFilePath)) {
            try {
                fs.unlinkSync(this.cacheFilePath);
                console.log('Cache JSON supprimé, rafraîchissement forcé');
                this.logger.logInfo('Cache JSON supprimé pour rafraîchissement forcé');
            } catch (error) {
                this.logger.logError('Erreur lors de la suppression du cache', error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    /**
     * Charge le cache depuis le fichier JSON
     */
    loadCache(): Map<string, CachedCollection> {
        const cachedCollections = new Map<string, CachedCollection>();
        
        if (!this.cacheFilePath) return cachedCollections;
        
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf8');
                const cacheData: JsonCacheData = JSON.parse(cacheContent);
                
                // Convertir les données JSON en cache mémoire
                for (const [collectionName, data] of Object.entries(cacheData.collections)) {
                    const methods = data.methods.map(method => ({
                        ...method,
                        lastRun: method.lastRun ? new Date(method.lastRun) : undefined
                    }));
                    
                    const files = data.files.map(f => vscode.Uri.file(f));
                    let testFiles = data.testFiles || []; // Pour la compatibilité avec les anciens caches
                    
                    // Si pas de testFiles dans le cache, noter pour reconstruction
                    if (testFiles.length === 0 && methods.length > 0) {
                        this.logger.logInfo(`Cache nécessite une reconstruction pour "${collectionName}"`);
                    }
                    
                    cachedCollections.set(collectionName, {
                        collection: data.collection,
                        files,
                        methods,
                        testFiles,
                        lastScan: new Date(data.lastScan)
                    });
                }
                
                console.log(`Cache chargé depuis ${this.cacheFilePath}: ${Object.keys(cacheData.collections).length} collections`);
                this.logger.logSuccess(`Cache chargé: ${Object.keys(cacheData.collections).length} collections`);
            }
        } catch (error) {
            this.logger.logError('Erreur lors du chargement du cache JSON', error instanceof Error ? error : new Error(String(error)));
        }
        
        return cachedCollections;
    }

    /**
     * Sauvegarde le cache vers le fichier JSON
     */
    async saveCache(cachedCollections: Map<string, CachedCollection>): Promise<void> {
        if (!this.cacheFilePath) return;
        
        try {
            // S'assurer que le dossier .vscode existe
            const vscodeDirPath = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(vscodeDirPath)) {
                fs.mkdirSync(vscodeDirPath, { recursive: true });
            }
            
            const cacheData: JsonCacheData = {
                collections: {},
                lastUpdate: new Date().toISOString()
            };
            
            for (const [collectionName, cache] of cachedCollections.entries()) {
                cacheData.collections[collectionName] = {
                    collection: cache.collection,
                    files: cache.files.map(f => f.fsPath),
                    methods: cache.methods.map(method => ({
                        ...method,
                        lastRun: method.lastRun ? method.lastRun.toISOString() : undefined
                    })) as any,
                    testFiles: cache.testFiles,
                    lastScan: cache.lastScan.toISOString()
                };
            }
            
            // Sauvegarder dans le fichier JSON avec indentation pour la lisibilité
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');


            this.logger.logSuccess(`Cache sauvegardé: ${cachedCollections.size} collections`);
        } catch (error) {
            this.logger.logError('Erreur lors de la sauvegarde du cache JSON', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Vérifie si le cache est périmé (plus de 30 minutes)
     */
    isCacheStale(lastScan: Date): boolean {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        return lastScan < thirtyMinutesAgo;
    }

    /**
     * Nettoie les ressources
     */
    dispose(): void {
        // Rien à nettoyer pour le moment
        this.logger.logInfo('CacheService nettoyé');
    }
}