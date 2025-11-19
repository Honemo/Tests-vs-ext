import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CachedCollection, JsonCacheData } from '../types';
import { LoggingService } from './LoggingService';

/**
 * JSON cache management service for PHP Test Collections Explorer
 * 
 * Manages test data persistence in JSON files
 * with workspace-specific support and automatic .gitignore handling.
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
     * Gets the cache file path
     */
    getCacheFilePath(): string {
        return this.cacheFilePath;
    }

    /**
     * Initializes cache path based on current workspace
     */
    private initializeCachePath(): void {
        let cacheFileName = 'php-test-collections-cache.json';
        
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            
            // Create a unique filename for each workspace
            if (vscode.workspace.workspaceFolders.length > 1) {
                const workspaceNames = vscode.workspace.workspaceFolders
                    .map(folder => path.basename(folder.uri.fsPath))
                    .join('-');
                cacheFileName = `php-test-collections-cache-${workspaceNames}.json`;
            }
            
            // Add workspace identifier if available
            if (vscode.workspace.name) {
                const safeName = vscode.workspace.name.replace(/[^a-zA-Z0-9-_]/g, '-');
                cacheFileName = `php-test-collections-cache-${safeName}.json`;
            }
            
            this.cacheFilePath = path.join(workspaceRoot, '.vscode', cacheFileName);
            
            console.log(`Cache initialized for workspace: ${this.cacheFilePath}`);
            this.logger.logInfo(`Cache initialized: ${this.cacheFilePath}`);
        } else {
            // Fallback to global extension storage if no workspace
            this.cacheFilePath = path.join(this.context.globalStorageUri.fsPath, cacheFileName);
        }
    }

    /**
     * Forces refresh by deleting the cache
     */
    async forceRefresh(): Promise<void> {
        // Delete cache file
        if (this.cacheFilePath && fs.existsSync(this.cacheFilePath)) {
            try {
                fs.unlinkSync(this.cacheFilePath);
                console.log('JSON cache deleted, forced refresh');
                this.logger.logInfo('JSON cache deleted for forced refresh');
            } catch (error) {
                this.logger.logError('Error deleting cache', error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    /**
     * Loads cache from JSON file
     */
    loadCache(): Map<string, CachedCollection> {
        const cachedCollections = new Map<string, CachedCollection>();
        
        if (!this.cacheFilePath) return cachedCollections;
        
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf8');
                const cacheData: JsonCacheData = JSON.parse(cacheContent);
                
                // Convert JSON data to memory cache
                for (const [collectionName, data] of Object.entries(cacheData.collections)) {
                    const methods = data.methods.map(method => ({
                        ...method,
                        lastRun: method.lastRun ? new Date(method.lastRun) : undefined
                    }));
                    
                    const files = data.files.map(f => vscode.Uri.file(f));
                    let testFiles = data.testFiles || []; // For compatibility with old caches
                    
                    // If no testFiles in cache, note for reconstruction
                    if (testFiles.length === 0 && methods.length > 0) {
                        this.logger.logInfo(`Cache requires reconstruction for "${collectionName}"`);
                    }
                    
                    cachedCollections.set(collectionName, {
                        collection: data.collection,
                        files,
                        methods,
                        testFiles,
                        lastScan: new Date(data.lastScan)
                    });
                }
                
                console.log(`Cache loaded from ${this.cacheFilePath}: ${Object.keys(cacheData.collections).length} collections`);
                this.logger.logSuccess(`Cache loaded: ${Object.keys(cacheData.collections).length} collections`);
            }
        } catch (error) {
            this.logger.logError('Error loading JSON cache', error instanceof Error ? error : new Error(String(error)));
        }
        
        return cachedCollections;
    }

    /**
     * Saves cache to JSON file
     */
    async saveCache(cachedCollections: Map<string, CachedCollection>): Promise<void> {
        if (!this.cacheFilePath) return;
        
        try {
            // Ensure .vscode folder exists
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
            
            // Save to JSON file with indentation for readability
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');

            this.logger.logSuccess(`Cache saved: ${cachedCollections.size} collections`);
        } catch (error) {
            this.logger.logError('Error saving JSON cache', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Checks if cache is stale (older than 30 minutes)
     */
    isCacheStale(lastScan: Date): boolean {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        return lastScan < thirtyMinutesAgo;
    }

    /**
     * Cleans up resources
     */
    dispose(): void {
        // Nothing to clean up for now
        this.logger.logInfo('CacheService disposed');
    }
}