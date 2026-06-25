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
        public readonly testType?: 'file' | 'collection' | 'method' | 'group',
        public readonly collection?: TestCollection,
        public readonly testMethod?: TestMethod,
        public readonly testFile?: TestFile,
        public readonly group?: string
    ) {
        super(label, collapsibleState);

        if (testType === 'collection') {
            // Icon for collections
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'testCollection';
            this.command = undefined;
        } else if (testType === 'group') {
            // Icon for test groups
            if (label === 'Ungrouped') {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            } else {
                this.iconPath = new vscode.ThemeIcon('tag', new vscode.ThemeColor('charts.yellow'));
            }
            this.contextValue = 'testGroup';
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
            
            // Add command to open file at the test method's line
            if (testMethod.filePath && testMethod.lineNumber) {
                this.command = {
                    command: 'tests-vs-extension.openTestFile',
                    title: 'Open Test',
                    arguments: [vscode.Uri.file(testMethod.filePath), testMethod.lineNumber]
                };
            }
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

        // Initialize context key for group-by-tags toggle button
        const initialGroupByTags = vscode.workspace.getConfiguration('phpTestCollections').get<boolean>('groupTestsByGroups', true);
        vscode.commands.executeCommand('setContext', 'phpTestCollections.groupByTagsEnabled', initialGroupByTags);

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

    private async getPhpFilesByInheritance(dirPath: string, excludePattern: string, testBaseClasses: string[]): Promise<vscode.Uri[]> {
        try {
            this.logger.logDebug(`🔍 Scanning for PHP files by inheritance in: ${dirPath}`);
            const files: vscode.Uri[] = [];
            const excludeSet = new Set<string>();

            // Collect already-found files by pattern to avoid duplicates
            const patternFiles = this.getPhpTestFiles(dirPath, excludePattern);
            for (const file of patternFiles) {
                excludeSet.add(file.fsPath);
            }

            // Recursively find all PHP files and check their inheritance
            const allPhpFiles = await this.getAllPhpFiles(dirPath);
            let checkedCount = 0;
            for (const phpFile of allPhpFiles) {
                // Skip files already found by pattern
                if (excludeSet.has(phpFile.fsPath)) {
                    continue;
                }

                // Verify file exists before checking
                if (!fs.existsSync(phpFile.fsPath)) {
                    this.logger.logWarning(`⚠️ File no longer exists: ${phpFile.fsPath}`);
                    continue;
                }

                // Check if file is a valid test file by inheritance
                if (this.testParser.isValidPhpTestFile(phpFile.fsPath, testBaseClasses)) {
                    files.push(phpFile);
                    this.logger.logDebug(`✅ Found test file by inheritance: ${path.basename(phpFile.fsPath)}`);
                }

                checkedCount++;
                // Prevent scanning too many files (safety limit)
                if (checkedCount > 10000) {
                    this.logger.logWarning(`⚠️ Inheritance scanning stopped: more than 10000 PHP files to check`);
                    break;
                }
            }

            this.logger.logDebug(`✅ Found ${files.length} additional PHP files by inheritance (checked ${checkedCount} files)`);
            return files;
        } catch (error) {
            this.logger.logError('Error reading PHP files by inheritance', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    private async getAllPhpFiles(dirPath: string): Promise<vscode.Uri[]> {
        try {
            const files: vscode.Uri[] = [];

            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);

                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const stat = fs.statSync(itemPath);

                    if (stat.isDirectory()) {
                        // Recursion in subdirectories
                        files.push(...await this.getAllPhpFiles(itemPath));
                    } else if (stat.isFile() && item.endsWith('.php')) {
                        // Add all PHP files
                        files.push(vscode.Uri.file(itemPath));
                    }
                }
            }

            return files;
        } catch (error) {
            this.logger.logError('Error reading all PHP files', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    private mergeUniqueFiles(filesA: vscode.Uri[], filesB: vscode.Uri[]): vscode.Uri[] {
        this.logger.logDebug(`🔗 mergeUniqueFiles: ${filesA.length} pattern files + ${filesB.length} inheritance files`);
        const pathSet = new Set<string>();
        const result: vscode.Uri[] = [];

        for (const file of filesA) {
            pathSet.add(file.fsPath);
            result.push(file);
        }

        let addedFromB = 0;
        for (const file of filesB) {
            if (!pathSet.has(file.fsPath)) {
                pathSet.add(file.fsPath);
                result.push(file);
                addedFromB++;
            }
        }

        this.logger.logDebug(`🔗 Merge result: ${result.length} total (added ${addedFromB} from inheritance)`);
        return result;
    }

    updateTestStatus(collectionName: string, className: string, methodName: string, status: TestStatus, errorMessage?: string, failureDetails?: string): void {
        this.logger.logInfo(`🔄 Updating test status: ${collectionName} :: ${className} :: ${methodName} => ${status}`);
        const cached = this.cachedCollections.get(collectionName);
        if (!cached) {
            this.logger.logWarning(`⚠️ Collection NOT found in cache: ${collectionName}`);
            return;
        }

        this.logger.logDebug(`   📊 Searching in ${cached.methods.length} methods`);
        this.logger.logDebug(`   🔎 Looking for: className="${className}", methodName="${methodName}"`);

        const method = cached.methods.find(m => {
            const match = m.className === className && m.name === methodName;
            if (!match) {
                this.logger.logDebug(`      ❌ No match: ${m.className}::${m.name}`);
            }
            return match;
        });

        if (method) {
            this.logger.logDebug(`   ✅ Found method! Updating status to: ${status}`);
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
            // Collection: return groups (if enabled) or files directly
            const config = vscode.workspace.getConfiguration('phpTestCollections');
            const groupByGroups = config.get<boolean>('groupTestsByGroups', true);
            if (groupByGroups) {
                return this.getCollectionGroups(element.collection);
            }
            return this.getFilesForGroup(element.collection, undefined);
        } else if (element.testType === 'group' && element.collection && element.group !== undefined) {
            // Group: return files belonging to this group
            return this.getFilesForGroup(element.collection, element.group);
        } else if (element.testType === 'file' && element.collection && element.resourceUri) {
            // File: return methods filtered by parent group if present
            return this.getMethodsForGroupAndFile(element.collection, element.group, element.resourceUri);
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

    private getCollectionGroups(collection: TestCollection): TestItem[] {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        const groups = new Set<string>();
        for (const method of cached.methods) {
            if (method.groups && method.groups.length > 0) {
                method.groups.forEach(g => groups.add(g));
            } else {
                groups.add('Ungrouped');
            }
        }

        const sorted = Array.from(groups).sort((a, b) => {
            if (a === 'Ungrouped') return 1;
            if (b === 'Ungrouped') return -1;
            return a.localeCompare(b);
        });

        return sorted.map(group => new TestItem(
            group,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            'group',
            collection,
            undefined,
            undefined,
            group
        ));
    }

    private getFilesForGroup(collection: TestCollection, group: string | undefined): TestItem[] {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        const fileSet = new Set<string>();
        for (const method of cached.methods) {
            if (group === undefined) {
                // No group filter: include all files
                fileSet.add(method.filePath);
            } else {
                const methodGroups = method.groups || [];
                const isUngrouped = group === 'Ungrouped' && methodGroups.length === 0;
                if (isUngrouped || methodGroups.includes(group)) {
                    fileSet.add(method.filePath);
                }
            }
        }

        return Array.from(fileSet)
            .map(filePath => new TestItem(
                path.basename(filePath),
                vscode.TreeItemCollapsibleState.Collapsed,
                vscode.Uri.file(filePath),
                'file',
                collection,
                undefined,
                undefined,
                group
            ))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    private getMethodsForGroupAndFile(collection: TestCollection, group: string | undefined, fileUri: vscode.Uri): TestItem[] {
        const cached = this.cachedCollections.get(collection.name);
        if (!cached) return [];

        const fileMethods = cached.methods.filter(m => m.filePath === fileUri.fsPath);

        const filtered = group === undefined
            ? fileMethods
            : fileMethods.filter(m => {
                const mg = m.groups || [];
                return group === 'Ungrouped' ? mg.length === 0 : mg.includes(group);
            });

        return filtered.map(method => new TestItem(
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

                    // Get files by pattern (optimized)
                    let phpFiles = this.getPhpTestFiles(collectionPath, pattern);
                    this.logger.logDebug(`📄 ${phpFiles.length} PHP files found by pattern`);
                    this.logger.logDebug(`📋 Pattern files: ${phpFiles.map(f => path.basename(f.fsPath)).join(', ')}`);

                    // If testBaseClasses are configured, also find files by inheritance
                    if (collection.testBaseClasses && collection.testBaseClasses.length > 0) {
                        this.logger.logDebug(`🔍 Also searching for files by inheritance from base classes: ${collection.testBaseClasses.join(', ')}`);
                        const inheritanceFiles = await this.getPhpFilesByInheritance(collectionPath, pattern, collection.testBaseClasses);
                        this.logger.logDebug(`📄 ${inheritanceFiles.length} additional PHP files found by inheritance`);
                        this.logger.logDebug(`📋 Inheritance files BEFORE merge: ${inheritanceFiles.map(f => path.basename(f.fsPath)).join(', ')}`);

                        const beforeMerge = phpFiles.length;
                        phpFiles = this.mergeUniqueFiles(phpFiles, inheritanceFiles);
                        const afterMerge = phpFiles.length;
                        this.logger.logDebug(`🔗 After merge: ${beforeMerge} + ${inheritanceFiles.length} = ${afterMerge} files`);
                        this.logger.logDebug(`📋 All files after merge: ${phpFiles.map(f => path.basename(f.fsPath)).join(', ')}`);
                    }

                    files.push(...phpFiles);
                    this.logger.logDebug(`✅ Total files to parse: ${phpFiles.length}`);

                    // Parse each PHP file to extract test methods
                    for (const fileUri of phpFiles) {
                        this.logger.logDebug(`📖 Parsing file: ${path.basename(fileUri.fsPath)}`);
                        const fileMethods = await this.testParser.parsePhpTestFile(fileUri.fsPath, collection);
                        this.logger.logDebug(`   ✅ Found ${fileMethods.length} methods in ${path.basename(fileUri.fsPath)}`);
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
                    this.logger.logDebug(`🎯 Total methods parsed: ${methods.length}`);
                    this.logger.logDebug(`📚 Total test files created: ${testFiles.length}`);
                }
            }

            // Merge with existing cache to preserve test status
            const existingCache = this.cachedCollections.get(collection.name);
            if (existingCache) {
                this.logger.logDebug(`🔄 Merging new methods with existing cache to preserve status...`);
                const existingMethodMap = new Map<string, TestMethod>();
                for (const method of existingCache.methods) {
                    const key = `${method.className}::${method.name}`;
                    existingMethodMap.set(key, method);
                }

                // Preserve status from cache for matching methods
                for (const method of methods) {
                    const key = `${method.className}::${method.name}`;
                    const existing = existingMethodMap.get(key);
                    if (existing) {
                        method.status = existing.status;
                        method.lastRun = existing.lastRun;
                        method.errorMessage = existing.errorMessage;
                        this.logger.logDebug(`   ✅ Preserved status for ${key}: ${method.status}`);
                    }
                }
            }

            // Cache it
            this.logger.logDebug(`💾 Caching collection "${collection.name}": ${methods.length} methods, ${files.length} files, ${testFiles.length} test files`);
            this.cachedCollections.set(collection.name, {
                collection,
                files,
                methods,
                testFiles,
                lastScan: new Date()
            });

            // Verify cache was set
            const cachedVerify = this.cachedCollections.get(collection.name);
            this.logger.logDebug(`✅ Cache verification: ${cachedVerify ? cachedVerify.methods.length : 0} methods in cache`);

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

    async runTestGroup(collection: TestCollection, group: string): Promise<void> {
        await this.testRunner.runTestGroup(collection, group);
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

    async openTestFile(uri: vscode.Uri, lineNumber?: number): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            // If line number is provided, navigate to that line
            if (lineNumber !== undefined && lineNumber > 0) {
                const position = new vscode.Position(lineNumber - 1, 0); // Convert to 0-based
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
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

    async setGroupByTags(enabled: boolean): Promise<void> {
        const config = vscode.workspace.getConfiguration('phpTestCollections');
        await config.update('groupTestsByGroups', enabled, vscode.ConfigurationTarget.Workspace);
        await vscode.commands.executeCommand('setContext', 'phpTestCollections.groupByTagsEnabled', enabled);
        this.refresh();
    }

    dispose(): void {
        this.fileWatcher.dispose();
        this.testRunner.dispose();
        // TestParser and CacheService don't have resources to clean up
        this.logger.dispose();
    }
}