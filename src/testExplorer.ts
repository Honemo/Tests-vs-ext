import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

// Import types from dedicated module
import {
    TestCollection,
    TestMethod,
    TestFile,
    TestStatus,
    CachedCollection,
    JsonCacheData
} from './types';

// Import services
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
            // Icon for collections
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'testCollection';
            this.command = undefined;
        } else if (testType === 'file') {
            // Icon for test files
            this.iconPath = new vscode.ThemeIcon('file');
            this.contextValue = 'testFile';
            this.tooltip = resourceUri?.fsPath;
            this.resourceUri = resourceUri;
        } else if (testType === 'method' && testMethod) {
            // Icon based on test status
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
            
            // Context for test methods
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
        
        // Initialize services
        this.logger = new LoggingService();
        this.cacheService = new CacheService(this.context, this.logger);
        this.testRunner = new TestRunner(this.logger);
        this.testParser = new TestParser(this.logger);
        this.fileWatcher = new FileWatcher(this.logger);
        this.logger.log('🚀 PHP Test Collections extension initialized');
        
        // Load cache from service
        const loadedCache = this.cacheService.loadCache();
        for (const [key, value] of loadedCache) {
            this.cachedCollections.set(key, value);
        }
        
        // Configure all watches via FileWatcher
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
        // Clear in-memory cache
        this.cachedCollections.clear();
        
        // Use cache service to force refresh
        this.cacheService.forceRefresh();
        
        // Reload everything
        await this.loadCollections();
        this.refresh();
        
        vscode.window.showInformationMessage('Test cache refreshed!');
    }

    private shouldRefreshCache(collection: TestCollection): boolean {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return true;
        
        // Check if files have changed since last scan
        const hasFileChanges = this.hasFileSystemChanges(collection, cached);
        if (hasFileChanges) return true;
        
        // Refresh if more than 30 minutes have elapsed (longer with JSON cache)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        return cached.lastScan < thirtyMinutesAgo;
    }

    private hasFileSystemChanges(collection: TestCollection, cached: CachedCollection): boolean {
        if (!vscode.workspace.workspaceFolders) return false;
        
        try {
            // Quickly check if file count has changed
            const pattern = collection.pattern || '**/*Test.php';
            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const collectionPath = path.join(workspaceFolder.uri.fsPath, collection.path);
                
                // Check if folder still exists
                if (!fs.existsSync(collectionPath)) {
                    return true;
                }
                
                // Count PHP files quickly
                const phpFiles = this.getPhpTestFiles(collectionPath, pattern);
                if (phpFiles.length !== cached.files.length) {
                    return true;
                }
            }
        } catch (error) {
            this.logger.logError('Error checking file changes', error instanceof Error ? error : new Error(String(error)));
            return true; // Force refresh on error
        }
        
        return false;
    }

    private getPhpTestFiles(dirPath: string, pattern: string): vscode.Uri[] {
        try {
            this.logger.logDebug(`📁 Getting PHP files in: ${dirPath} with pattern: ${pattern}`);
            const files: vscode.Uri[] = [];
            
            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const stat = fs.statSync(itemPath);
                    
                    if (stat.isDirectory()) {
                        // Recursion in subdirectories
                        files.push(...this.getPhpTestFiles(itemPath, pattern));
                    } else if (stat.isFile() && item.endsWith('.php')) {
                        // Check if file matches pattern
                        if (this.matchesPattern(item, pattern)) {
                            files.push(vscode.Uri.file(itemPath));
                        }
                    }
                }
            }
            
            return files;
        } catch (error) {
            this.logger.logError('Error reading PHP files', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    private matchesPattern(filename: string, pattern: string): boolean {
        // Simple conversion from glob pattern to regex
        const regex = new RegExp(
            pattern
                .replace(/\*\*/g, '.*')  // ** -> .*
                .replace(/\*/g, '[^/]*') // * -> [^/]*
                .replace(/\?/g, '.')     // ? -> .
        );
        
        return regex.test(filename);
    }

    updateTestStatus(collectionName: string, className: string, methodName: string, status: TestStatus, errorMessage?: string, failureDetails?: string): void {
        this.logger.logInfo(`🔄 Updating test status: ${collectionName} :: ${className} :: ${methodName} => ${status}`);
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
            
            // Update cache and save
            this.cacheService.saveCache(this.cachedCollections);
            this.refresh();
        }
    }

    getTreeItem(element: TestItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TestItem): Promise<TestItem[]> {
        if (!element) {
            // Root: return collections
            await this.loadCollections();
            return this.collections.map(collection => new TestItem(
                collection.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                'collection',
                collection
            ));
        } else if (element.testType === 'collection' && element.collection) {
            // Collection: return test files
            return await this.getCollectionFiles(element.collection);
        } else if (element.testType === 'file' && element.collection && element.resourceUri) {
            // File: return test methods
            return await this.getFileMethods(element.collection, element.resourceUri);
        }
        
        return [];
    }

    private async loadCollections(): Promise<void> {
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        this.collections = config.get<TestCollection[]>('collections', []);
        
        this.logger.logDebug(`🔍 Loading ${this.collections.length} configured collections`);
        for (const collection of this.collections) {
            this.logger.logDebug(`📂 Collection: ${collection.name} (path: ${collection.path})`);
        }
        
        // Automatically load methods for each collection
        for (const collection of this.collections) {
            await this.loadCollectionMethods(collection);
        }
        
        this.logger.logDebug(`✅ Collections loaded. Cache contains: ${this.cachedCollections.size} collections`);
    }

    private async getCollectionFiles(collection: TestCollection): Promise<TestItem[]> {
        this.logger.logDebug(`📁 Getting files for collection: ${collection.name}`);
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        // Group methods by file
        const fileGroups = new Map<string, TestMethod[]>();
        for (const method of cached.methods) {
            const filePath = method.filePath;
            if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, []);
            }
            fileGroups.get(filePath)!.push(method);
        }

        // Create file items
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

        // Filter methods for this file
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
        // Check cache first
        if (!this.shouldRefreshCache(collection)) {
            this.logger.logDebug(`💾 Using cache for: ${collection.name}`);
            return; // Use existing cache
        }

        this.logger.logDebug(`🔄 Loading collection: ${collection.name}`);
        
        try {
            if (!vscode.workspace.workspaceFolders) {
                this.logger.logWarning(`⚠️ No workspace folder found`);
                return;
            }

            const methods: TestMethod[] = [];
            const files: vscode.Uri[] = [];
            const testFiles: TestFile[] = [];

            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const collectionPath = path.join(workspaceFolder.uri.fsPath, collection.path);
                this.logger.logDebug(`📁 Getting files for collection: ${collection.name}`);
                this.logger.logDebug(`📂 Scanning directory: ${collectionPath}`);
                
                if (fs.existsSync(collectionPath)) {
                    const pattern = collection.pattern || '**/*Test.php';
                    this.logger.logDebug(`🔍 Search pattern: ${pattern}`);
                    const phpFiles = this.getPhpTestFiles(collectionPath, pattern);
                    this.logger.logDebug(`📄 ${phpFiles.length} PHP files found`);
                    files.push(...phpFiles);

                    // Parse each PHP file to extract test methods
                    for (const fileUri of phpFiles) {
                        const fileMethods = await this.testParser.parsePhpTestFile(fileUri.fsPath, collection);
                        methods.push(...fileMethods);
                        
                        // Create a TestFile
                        const testFile: TestFile = {
                            filePath: fileUri.fsPath,
                            className: 'Unknown', // Will be extracted during parsing
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

            // Cache it
            this.cachedCollections.set(collection.name, {
                collection,
                files,
                methods,
                testFiles,
                lastScan: new Date()
            });

            // Save cache
            this.cacheService.saveCache(this.cachedCollections);
            
            this.logger.logSuccess(`Collection "${collection.name}" loaded: ${methods.length} methods in ${files.length} files`);
        } catch (error) {
            this.logger.logError(`Error loading collection "${collection.name}"`, error instanceof Error ? error : new Error(String(error)));
        }
    }

    private createTestFiles(files: vscode.Uri[], methods: TestMethod[], collection: TestCollection): TestFile[] {
        const testFiles: TestFile[] = [];
        
        // Group methods by file
        const methodsByFile = new Map<string, TestMethod[]>();
        for (const method of methods) {
            if (!methodsByFile.has(method.filePath)) {
                methodsByFile.set(method.filePath, []);
            }
            methodsByFile.get(method.filePath)!.push(method);
        }
        
        // Create TestFiles
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

    // Methods delegated to TestRunner
    async runTestCollection(collection: TestCollection): Promise<void> {
        await this.testRunner.runTestCollection(collection);
    }

    async runSingleTest(testMethod: TestMethod): Promise<void> {
        await this.testRunner.runTestMethod(testMethod, (testMethod) => {
            // Callback to update test status
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
            // Callback to update test status
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
        // Update cache after manual modification
        this.cacheService.saveCache(this.cachedCollections);
        this.refresh();
    }

    async openTestFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Unable to open file: ${error}`);
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
            method.status = TestStatus.Unknown; // "Running" status
            this.refresh();
        }
    }

    // Preserved utility methods
    private buildDockerCommand(collection: TestCollection, command: string, workspacePath: string): string {
        if (!collection.useDocker || !collection.dockerImage) {
            return command;
        }

        // Build Docker command
        const dockerCommand = `docker exec ${collection.dockerImage} ${command}`;
        
        this.logger.log(`🐳 Docker transformation for collection "${collection.name}"`);
        this.logger.log(`   Original command: ${command}`);
        this.logger.log(`   Docker command:   ${dockerCommand}`);
        this.logger.log('');
        
        return dockerCommand;
    }

    // Methods for VS Code actions (remain in provider)
    async showTestResultsDetails(testMethod: TestMethod): Promise<void> {
        if (testMethod.errorMessage) {
			const message = `Error details for ${testMethod.className}::${testMethod.name}:\n\n${testMethod.errorMessage}`;
			this.logger.logErrorDetails(message);
        } else {
            await vscode.window.showInformationMessage(`No error recorded for ${testMethod.className}::${testMethod.name}`);
        }
    }

    showOutput(): void {
        this.logger.show();
    }

    // Methods for VS Code commands
    async configureTestFolders(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace opened');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');

        vscode.window.showInformationMessage('Configuring test folders...');

        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'phpTestCollections.collections');
        } catch (error) {
            this.logger.logError('Error opening settings', error instanceof Error ? error : new Error(String(error)));
        }
    }

    async addTestCollection(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace opened');
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Test collection name',
            placeHolder: 'Ex: Unit Tests'
        });

        if (!name) return;

        const path = await vscode.window.showInputBox({
            prompt: 'Path to test folder',
            placeHolder: 'Ex: tests/Unit'
        });

        if (!path) return;

        const command = await vscode.window.showInputBox({
            prompt: 'Execution command',
            placeHolder: 'Ex: vendor/bin/phpunit tests/Unit'
        });

        if (!command) return;

        const dockerChoice = await vscode.window.showQuickPick(
            ['No', 'Yes'],
            { placeHolder: 'Use Docker?' }
        );

        let useDocker = false;
        let dockerImage = '';

        if (dockerChoice === 'Yes') {
            useDocker = true;
            const image = await vscode.window.showInputBox({
                prompt: 'Docker image name',
                placeHolder: 'Ex: my-php-container'
            });
            dockerImage = image || '';
        }

        // Create new collection
        const newCollection: TestCollection = {
            name,
            path,
            command,
            useDocker,
            dockerImage: useDocker ? dockerImage : undefined
        };

        // Add to configuration
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        const collections = config.get<TestCollection[]>('collections', []);
        collections.push(newCollection);
        
        try {
            await config.update('collections', collections, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Collection "${name}" added!`);
            await this.loadCollections();
            this.refresh();
        } catch (error) {
            this.logger.logError('Error adding collection', error instanceof Error ? error : new Error(String(error)));
            vscode.window.showErrorMessage('Unable to add collection');
        }
    }

    dispose(): void {
        this.fileWatcher.dispose();
        this.testRunner.dispose();
        // TestParser and CacheService don't have resources to clean up
        this.logger.dispose();
    }
}