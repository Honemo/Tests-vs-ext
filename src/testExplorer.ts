import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

// Import des types depuis le module dédié
import {
    TestCollection,
    TestMethod,
    TestFile,
    TestStatus,
    CachedCollection,
    JsonCacheData
} from './types';

// Import des services
import { LoggingService } from './services/LoggingService';
import { CacheService } from './services/CacheService';
import { TestRunner } from './services/TestRunner';
import { TestParser } from './services/TestParser';
import { FileWatcher } from './services/FileWatcher';

export class TestItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri?: vscode.Uri,
        public readonly testType?: 'file' | 'collection' | 'method',
        public readonly collection?: TestCollection,
        public readonly testMethod?: TestMethod,
        public readonly testFile?: TestFile
    ) {
        super(label, collapsibleState);
        
        if (testType === 'collection') {
            // Icône pour les collections
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'testCollection';
            this.command = undefined;
        } else if (testType === 'file' && testFile) {
            // Icône pour les fichiers de test
            this.iconPath = new vscode.ThemeIcon('file');
            this.contextValue = 'testFile';
            // this.tooltip = resourceUri?.fsPath;
            this.tooltip = testFile.status;
            this.resourceUri = resourceUri;
        } else if (testType === 'method' && testMethod) {
            // Icône basée sur le statut du test
            if (testMethod.status === TestStatus.Passed) {
                this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            } else if (testMethod.status === TestStatus.Failed) {
                this.iconPath = new vscode.ThemeIcon('close', new vscode.ThemeColor('testing.iconFailed'));
            } else if (testMethod.status === TestStatus.Skipped) {
                this.iconPath = new vscode.ThemeIcon('debug-step-over', new vscode.ThemeColor('testing.iconSkipped'));
            } else if (testMethod.status === TestStatus.Running) {
                this.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            }
            
            // Contexte pour les méthodes de test
            this.contextValue = 'testMethod';
            this.tooltip = `${testMethod.className}::${testMethod.name}`;
        }
		
    }
}

export class TestExplorerProvider implements vscode.TreeDataProvider<TestItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TestItem | undefined | null | void> = new vscode.EventEmitter<TestItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TestItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private collections: TestCollection[] = [];
    private cachedCollections: Map<string, CachedCollection> = new Map();
    private context: vscode.ExtensionContext;
    private logger: LoggingService;
    private cacheService: CacheService;
    private testRunner: TestRunner;
    private testParser: TestParser;
    private fileWatcher: FileWatcher;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // Initialiser les services
        this.logger = new LoggingService();
        this.cacheService = new CacheService(this.context, this.logger);
        this.testRunner = new TestRunner(this.logger);
        this.testParser = new TestParser(this.logger);
        this.fileWatcher = new FileWatcher(this.logger);
        this.logger.log('🚀 Extension PHP Test Collections initialisée');
        
        // Charger le cache depuis le service
        const loadedCache = this.cacheService.loadCache();
        for (const [key, value] of loadedCache) {
            this.cachedCollections.set(key, value);
        }
        
        // Configurer toutes les surveillances via FileWatcher
        this.fileWatcher.watchAll({
            onFileChange: () => this.refresh(),
            onWorkspaceChange: () => {
                this.cachedCollections.clear();
                const refreshedCache = this.cacheService.loadCache();
                for (const [key, value] of refreshedCache) {
                    this.cachedCollections.set(key, value);
                }
                this.refresh();
            },
            onConfigChange: (event) => {
                if (event.affectsConfiguration('phpTestCollections')) {
                    this.refresh();
                }
            },
            onTerminalClose: () => {
                this.testRunner.cleanupClosedTerminals();
            },
            configurationSection: 'phpTestCollections'
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async forceRefresh(): Promise<void> {
        // Vider le cache en mémoire
        this.cachedCollections.clear();
        
        // Utiliser le service de cache pour forcer le rafraîchissement
        this.cacheService.forceRefresh();
        
        // Recharger tout
        await this.loadCollections();
        this.refresh();
        
        vscode.window.showInformationMessage('Cache des tests rafraîchi !');
    }

    private shouldRefreshCache(collection: TestCollection): boolean {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return true;
        
        // Vérifier si les fichiers ont changé depuis le dernier scan
        const hasFileChanges = this.hasFileSystemChanges(collection, cached);
        if (hasFileChanges) return true;
        
        // Rafraîchir si plus de 30 minutes se sont écoulées (plus long avec le cache JSON)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        return cached.lastScan < thirtyMinutesAgo;
    }

    private hasFileSystemChanges(collection: TestCollection, cached: CachedCollection): boolean {
        if (!vscode.workspace.workspaceFolders) return false;
        
        try {
            // Vérifier rapidement si le nombre de fichiers a changé
            const pattern = collection.pattern || '**/*Test.php';
            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const collectionPath = path.join(workspaceFolder.uri.fsPath, collection.path);
                
                // Vérifier si le dossier existe toujours
                if (!fs.existsSync(collectionPath)) {
                    return true;
                }
                
                // Compter les fichiers PHP rapidement
                const phpFiles = this.getPhpTestFiles(collectionPath, pattern);
                if (phpFiles.length !== cached.files.length) {
                    return true;
                }
            }
        } catch (error) {
            this.logger.logError('Erreur lors de la vérification des changements de fichiers', error instanceof Error ? error : new Error(String(error)));
            return true; // En cas d'erreur, forcer le rafraîchissement
        }
        
        return false;
    }

    private getPhpTestFiles(dirPath: string, pattern: string): vscode.Uri[] {
        try {
			this.logger.logInfo(`📁 Récupération des fichiers PHP dans: ${dirPath} avec le pattern: ${pattern}`);
            const files: vscode.Uri[] = [];
            
            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const stat = fs.statSync(itemPath);
                    
                    if (stat.isDirectory()) {
                        // Récursion dans les sous-dossiers
                        files.push(...this.getPhpTestFiles(itemPath, pattern));
                    } else if (stat.isFile() && item.endsWith('.php')) {
                        // Vérifier si le fichier correspond au pattern
                        if (this.matchesPattern(item, pattern)) {
                            files.push(vscode.Uri.file(itemPath));
                        }
                    }
                }
            }
            
            return files;
        } catch (error) {
            this.logger.logError('Erreur lors de la lecture des fichiers PHP', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    private matchesPattern(filename: string, pattern: string): boolean {
        // Conversion simple de pattern glob vers regex
        const regex = new RegExp(
            pattern
                .replace(/\*\*/g, '.*')  // ** -> .*
                .replace(/\*/g, '[^/]*') // * -> [^/]*
                .replace(/\?/g, '.')     // ? -> .
        );
        
        return regex.test(filename);
    }

    updateTestStatus(collectionName: string, className: string, methodName: string, status: TestStatus, errorMessage?: string, failureDetails?: string): void {
        this.logger.logInfo(`🔄 Mise à jour du statut du test: ${collectionName} :: ${className} :: ${methodName} => ${status}`);
		this.logger.logDebug(`Caca`);
		const cached = this.cachedCollections.get(collectionName);
        if (!cached) return;

        const method = cached.methods.find(m => 
            m.className === className && 
            m.name === methodName
        );

        if (method) {
            method.status = status;
            method.lastRun = new Date();
            method.errorMessage = errorMessage;
            
            // Mettre à jour le cache et sauvegarder
            this.cacheService.saveCache(this.cachedCollections);
            this.refresh();
        }
    }

    getTreeItem(element: TestItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TestItem): Promise<TestItem[]> {
        if (!element) {
            // Racine : retourner les collections
            await this.loadCollections();
            return this.collections.map(collection => new TestItem(
                collection.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                'collection',
                collection
            ));
        } else if (element.testType === 'collection' && element.collection) {
            // Collection : retourner les fichiers de test
            return await this.getCollectionFiles(element.collection);
        } else if (element.testType === 'file' && element.collection && element.resourceUri) {
            // Fichier : retourner les méthodes de test
            return await this.getFileMethods(element.collection, element.resourceUri);
        }
        
        return [];
    }

    private async loadCollections(): Promise<void> {
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        this.collections = config.get<TestCollection[]>('collections', []);
        
        this.logger.logInfo(`🔍 Chargement de ${this.collections.length} collections configurées`);
        for (const collection of this.collections) {
            this.logger.logInfo(`📂 Collection: ${collection.name} (path: ${collection.path})`);
        }
        
        // Charger automatiquement les méthodes pour chaque collection
        for (const collection of this.collections) {
            await this.loadCollectionMethods(collection);
        }
        
        this.logger.logInfo(`✅ Collections chargées. Cache contient: ${this.cachedCollections.size} collections`);
    }

    private async getCollectionFiles(collection: TestCollection): Promise<TestItem[]> {
		this.logger.logInfo(`📁 Récupération des fichiers pour la collection: ${collection.name}`);
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        // Regrouper les méthodes par fichier
        const fileGroups = new Map<string, TestMethod[]>();
        for (const method of cached.methods) {
            const filePath = method.filePath;
            if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, []);
            }
            fileGroups.get(filePath)!.push(method);
        }

        // Créer les items de fichier
        const fileItems: TestItem[] = [];
        for (const [filePath, methods] of fileGroups) {
            const fileName = path.basename(filePath);
            const fileUri = vscode.Uri.file(filePath);
            
            fileItems.push(new TestItem(
                fileName,
                vscode.TreeItemCollapsibleState.Collapsed,
                fileUri,
                'file',
                collection
            ));
        }
        
        return fileItems.sort((a, b) => a.label.localeCompare(b.label));
    }

    private async getFileMethods(collection: TestCollection, fileUri: vscode.Uri): Promise<TestItem[]> {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        // Filtrer les méthodes pour ce fichier
        const fileMethods = cached.methods.filter(method => method.filePath === fileUri.fsPath);
        
        return fileMethods.map(method => new TestItem(
            method.name,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'method',
            collection,
            method
        ));
    }

    private async loadCollectionMethods(collection: TestCollection): Promise<void> {
        // Vérifier d'abord le cache
        if (!this.shouldRefreshCache(collection)) {
            this.logger.logInfo(`💾 Utilisation du cache pour: ${collection.name}`);
            return; // Utiliser le cache existant
        }

        this.logger.logInfo(`🔄 Chargement de la collection: ${collection.name}`);
        
        try {
            if (!vscode.workspace.workspaceFolders) {
                this.logger.logWarning(`⚠️ Aucun workspace folder trouvé`);
                return;
            }

            const methods: TestMethod[] = [];
            const files: vscode.Uri[] = [];
            const testFiles: TestFile[] = [];

            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const collectionPath = path.join(workspaceFolder.uri.fsPath, collection.path);
				this.logger.logInfo(`📁 Récupération des fichiers pour la collection: ${collection.name}`);
                this.logger.logInfo(`📂 Scan du répertoire: ${collectionPath}`);
                
                if (fs.existsSync(collectionPath)) {
                    const pattern = collection.pattern || '**/*Test.php';
                    this.logger.logInfo(`🔍 Pattern de recherche: ${pattern}`);
                    const phpFiles = this.getPhpTestFiles(collectionPath, pattern);
                    this.logger.logInfo(`📄 ${phpFiles.length} fichiers PHP trouvés`);
                    files.push(...phpFiles);

                    // Parser chaque fichier PHP pour extraire les méthodes de test
                    for (const fileUri of phpFiles) {
                        const fileMethods = await this.testParser.parsePhpTestFile(fileUri.fsPath, collection);
                        methods.push(...fileMethods);
                        
                        // Créer un TestFile
                        const testFile: TestFile = {
                            filePath: fileUri.fsPath,
                            className: 'Unknown', // Sera extrait pendant le parsing
                            collection: collection,
                            totalTests: fileMethods.length,
                            passedTests: 0,
                            failedTests: 0,
                            errorTests: 0,
                            skippedTests: 0,
                            runningTests: 0
                        };
                        testFiles.push(testFile);
                    }
                }
            }

            // Mettre en cache
            this.cachedCollections.set(collection.name, {
                collection,
                files,
                methods,
                testFiles,
                lastScan: new Date()
            });

            // Sauvegarder le cache
            this.cacheService.saveCache(this.cachedCollections);
            
            this.logger.logSuccess(`Collection "${collection.name}" chargée: ${methods.length} méthodes dans ${files.length} fichiers`);
        } catch (error) {
            this.logger.logError(`Erreur lors du chargement de la collection "${collection.name}"`, error instanceof Error ? error : new Error(String(error)));
        }
    }

    private createTestFiles(files: vscode.Uri[], methods: TestMethod[], collection: TestCollection): TestFile[] {
        const testFiles: TestFile[] = [];
        
        // Regrouper les méthodes par fichier
        const methodsByFile = new Map<string, TestMethod[]>();
        for (const method of methods) {
            if (!methodsByFile.has(method.filePath)) {
                methodsByFile.set(method.filePath, []);
            }
            methodsByFile.get(method.filePath)!.push(method);
        }
        
        // Créer les TestFiles
        for (const fileUri of files) {
            const fileMethods = methodsByFile.get(fileUri.fsPath) || [];
            testFiles.push({
                filePath: fileUri.fsPath,
                className: fileMethods.length > 0 ? fileMethods[0].className : 'Unknown',
                collection: collection,
                totalTests: fileMethods.length,
                passedTests: 0,
                failedTests: 0,
                errorTests: 0,
                skippedTests: 0,
                runningTests: 0
            });
        }
        
        return testFiles;
    }

    // Méthodes déléguées au TestRunner
    async runTestCollection(collection: TestCollection): Promise<void> {
        await this.testRunner.runTestCollection(collection);
    }

    async runSingleTest(testMethod: TestMethod): Promise<void> {
        await this.testRunner.runTestMethod(testMethod, (testMethod) => {
			// Callback pour mettre à jour le statut du test
			this.updateTestStatus(
				testMethod.collection.name,
				testMethod.className,
				testMethod.name,
				testMethod.status || TestStatus.Unknown,
				testMethod.errorMessage
			);
		});
    }

    async runTestFile(fileUri: vscode.Uri, collection: TestCollection): Promise<void> {
        await this.testRunner.runTestFile(fileUri, collection, this.cachedCollections, (testMethod) => {
            // Callback pour mettre à jour le statut du test
            this.updateTestStatus(
                testMethod.collection.name,
                testMethod.className,
                testMethod.name,
                testMethod.status || TestStatus.Unknown,
                testMethod.errorMessage
            );
        });
    }

    async setTestStatusManually(testMethod: TestMethod): Promise<void> {
        await this.testRunner.setTestStatusManually(testMethod);
        // Mettre à jour le cache après modification manuelle
        this.cacheService.saveCache(this.cachedCollections);
        this.refresh();
    }

    async openTestFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Impossible d'ouvrir le fichier: ${error}`);
        }
    }

    setTestRunning(collectionName: string, className: string, methodName: string): void {
        const cached = this.cachedCollections.get(collectionName);
        if (!cached) return;

        const method = cached.methods.find(m => 
            m.className === className && 
            m.name === methodName
        );

        if (method) {
            method.status = TestStatus.Unknown; // Statut "en cours"
            this.refresh();
        }
    }

    // Méthodes utilitaires conservées
    private buildDockerCommand(collection: TestCollection, command: string, workspacePath: string): string {
        if (!collection.useDocker || !collection.dockerImage) {
            return command;
        }

        // Construire la commande Docker
        const dockerCommand = `docker exec ${collection.dockerImage} ${command}`;
        
        this.logger.log(`🐳 Transformation Docker pour la collection "${collection.name}"`);
        this.logger.log(`   Commande originale: ${command}`);
        this.logger.log(`   Commande Docker:    ${dockerCommand}`);
        this.logger.log('');
        
        return dockerCommand;
    }

    // Méthodes pour les actions VS Code (restent dans le provider)
    async showTestErrorDetails(testMethod: TestMethod): Promise<void> {
        if (testMethod.errorMessage) {
            const message = `Détails de l'erreur pour ${testMethod.className}::${testMethod.name}:\n\n${testMethod.errorMessage}`;
            await vscode.window.showInformationMessage(message, { modal: true });
        } else {
            await vscode.window.showInformationMessage(`Aucune erreur enregistrée pour ${testMethod.className}::${testMethod.name}`);
        }
    }

    showOutput(): void {
        this.logger.show();
    }

    // Méthodes pour les commandes VS Code
    async configureTestFolders(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Aucun workspace ouvert');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');

        vscode.window.showInformationMessage('Configuration des dossiers de test...');

        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:php-test-collections');
        } catch (error) {
            this.logger.logError('Erreur lors de l\'ouverture des paramètres', error instanceof Error ? error : new Error(String(error)));
        }
    }

    async addTestCollection(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Aucun workspace ouvert');
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Nom de la collection de tests',
            placeHolder: 'Ex: Unit Tests'
        });

        if (!name) return;

        const path = await vscode.window.showInputBox({
            prompt: 'Chemin vers le dossier des tests',
            placeHolder: 'Ex: tests/Unit'
        });

        if (!path) return;

        const command = await vscode.window.showInputBox({
            prompt: 'Commande d\'exécution',
            placeHolder: 'Ex: vendor/bin/phpunit tests/Unit'
        });

        if (!command) return;

        const dockerChoice = await vscode.window.showQuickPick(
            ['Non', 'Oui'],
            { placeHolder: 'Utiliser Docker ?' }
        );

        let useDocker = false;
        let dockerImage = '';

        if (dockerChoice === 'Oui') {
            useDocker = true;
            const image = await vscode.window.showInputBox({
                prompt: 'Nom de l\'image Docker',
                placeHolder: 'Ex: my-php-container'
            });
            dockerImage = image || '';
        }

        // Créer la nouvelle collection
        const newCollection: TestCollection = {
            name,
            path,
            command,
            useDocker,
            dockerImage: useDocker ? dockerImage : undefined
        };

        // Ajouter à la configuration
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        const collections = config.get<TestCollection[]>('collections', []);
        collections.push(newCollection);
        
        try {
            await config.update('collections', collections, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Collection "${name}" ajoutée !`);
            await this.loadCollections();
            this.refresh();
        } catch (error) {
            this.logger.logError('Erreur lors de l\'ajout de la collection', error instanceof Error ? error : new Error(String(error)));
            vscode.window.showErrorMessage('Impossible d\'ajouter la collection');
        }
    }

    dispose(): void {
        this.fileWatcher.dispose();
        this.testRunner.dispose();
        // TestParser et CacheService n'ont pas de ressources à nettoyer
        this.logger.dispose();
    }
}