import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { TestCollection, TestMethod, TestStatus, CachedCollection } from '../types';
import { LoggingService } from './LoggingService';

/**
 * PHPUnit test execution management service
 * 
 * Manages individual test execution, collections, and result parsing
 * with Docker support and output capture.
 */
export class TestRunner {
    private readonly logger: LoggingService;
    private collectionTerminals: Map<string, vscode.Terminal> = new Map();
    private terminalDataHandlers: Map<string, vscode.Disposable> = new Map();

    constructor(logger: LoggingService) {
        this.logger = logger;
    }

    /**
     * Execute all tests in a collection
     */
    async runTestCollection(collection: TestCollection): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace opened');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            
            // Build command with Docker if needed
            const finalCommand = this.buildDockerCommand(collection, collection.command, workspaceFolder.uri.fsPath);
            
            // Log the command
            this.logger.logCommand(`Executing collection: ${collection.name}`, finalCommand);
            
            // Execute command directly in terminal (without status updates)
            this.executeCollectionWithoutCapture(finalCommand, workspaceFolder.uri.fsPath, collection);
            
            const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
            vscode.window.showInformationMessage(`Running tests: ${collection.name}${dockerInfo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur: ${error}`);
        }
    }

    /**
     * Execute an individual test with output capture for result parsing
     */
    async runTestMethod(testMethod: TestMethod, onTestUpdate?: (testMethod: TestMethod) => void): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace opened');
                return;
            }
			if (onTestUpdate) {
				onTestUpdate({
					...testMethod,
					status: TestStatus.Running,
					lastRun: new Date(),
					errorMessage: undefined
				});
			}

            const workspaceFolder = vscode.workspace.workspaceFolders[0];

            // Build PHPUnit command for a specific test
            // Format: vendor/bin/phpunit --filter "TestClass::testMethod" [other options] path/to/file
            const collection = testMethod.collection;
            
            // Parse base command to separate PHPUnit command, options and path
            const baseCommand = collection.command;
            
            // Build final command with filter
            const filterOption = `--filter "${testMethod.className}::${testMethod.name}"`;
            let finalCommand = `${baseCommand} ${filterOption}`;
            
            // Add file path at the end
            const relativePath = path.relative(workspaceFolder.uri.fsPath, testMethod.filePath);
            finalCommand += ` ${relativePath}`;
            
            // Apply Docker if necessary
            finalCommand = this.buildDockerCommand(collection, finalCommand, workspaceFolder.uri.fsPath);
            
            // Log the command
            this.logger.logCommand(`Running test: ${testMethod.className}::${testMethod.name}`, finalCommand);
            
            // Execute with capture to parse the result
            this.executeTestWithCapture(finalCommand, workspaceFolder.uri.fsPath, testMethod, onTestUpdate);

            const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
            vscode.window.showInformationMessage(`Running test: ${testMethod.name}${dockerInfo}`);

        } catch (error) {
            vscode.window.showErrorMessage(`Erreur: ${error}`);
        }
    }

    /**
     * Execute a complete test file
     */
    async runTestFile(
        fileUri: vscode.Uri, 
        collection: TestCollection, 
        cachedCollections: Map<string, CachedCollection>,
        onTestUpdate?: (testMethod: TestMethod) => void
    ): Promise<void> {
        // 🔍 Start of runTestFile debug
        this.logger.log(`🚀 DEBUG runTestFile - Starting`);
        this.logger.logDebug(`📂 File: ${fileUri.fsPath}`);
        this.logger.logDebug(`📦 Collection: ${collection.name}`);
        this.logger.logDebug(`🐳 Docker: ${collection.useDocker ? `Yes (${collection.dockerImage})` : 'No'}`);

        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                this.logger.log(`❌ DEBUG - No workspace opened`);
                vscode.window.showErrorMessage('No workspace opened');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            this.logger.logDebug(`📁 DEBUG - Workspace: ${workspaceFolder.uri.fsPath}`);

            // Extract class name from file path
            const fileName = path.basename(fileUri.fsPath, '.php');
            
            // Search in method cache to find the corresponding class for this file
            const cachedData = cachedCollections.get(collection.name);
            this.logger.logDebug(`💾 DEBUG - Cache found: ${cachedData ? 'Yes' : 'No'}`);
            if (cachedData) {
                this.logger.logDebug(`Total cached methods: ${cachedData.methods.length}`);
                this.logger.logDebug(`Last cache update: ${cachedData.lastScan}`);
            }
            
            if (!cachedData) {
                this.logger.logDebug(`❌ DEBUG - No cached data for collection: ${collection.name}`);
                vscode.window.showErrorMessage('No cached data for this collection. Please refresh the view.');
                return;
            }

            // Find the first method from this file to get the class name
            const methodsFromFile = cachedData.methods.filter((method: TestMethod) => method.filePath === fileUri.fsPath);
            this.logger.logDebug(`🔍 DEBUG - Searching methods in file:`);
            this.logger.logDebug(`Search path: ${fileUri.fsPath}`);
            this.logger.logDebug(`Methods found: ${methodsFromFile.length}`);
            
            if (methodsFromFile.length > 0) {
                this.logger.logDebug(`First method: ${methodsFromFile[0].className}::${methodsFromFile[0].name}`);
                methodsFromFile.forEach((method, index) => {
                    this.logger.logDebug(`[${index}] ${method.className}::${method.name} (${method.filePath})`);
                });
            }

            if (methodsFromFile.length === 0) {
                this.logger.log(`❌ DEBUG - No methods found in this file`);
                vscode.window.showErrorMessage('No test methods found in this file.');
                return;
            }

            const className = methodsFromFile[0].className;
            this.logger.logDebug(`🏷️ DEBUG - Extracted class name: ${className}`);

            // Parse base command to separate PHPUnit command, options and path
            const baseCommand = collection.command;
            this.logger.logDebug(`📋 DEBUG - Base command: ${baseCommand}`);
            
            // Build final command with filter for the class
            const filterOption = `--filter "${className}"`;
            let finalCommand = `${baseCommand} ${filterOption}`;
            
            // Add file path at the end
            const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
            finalCommand += ` ${relativePath}`;            
            // Apply Docker if necessary
            finalCommand = this.buildDockerCommand(collection, finalCommand, workspaceFolder.uri.fsPath);

			for (const method of methodsFromFile) {
				if (onTestUpdate) {
					onTestUpdate({
						...method,
						status: TestStatus.Running,
						lastRun: new Date(),
						errorMessage: undefined
					});
				}
			}
			// Log the command
			this.logger.logCommand(`Executing test: ${fileName}`, finalCommand);
            
            // Execute with capture to process each method individually
            exec(finalCommand, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
                const output = stdout + stderr;
            	
                this.logger.log(`📊 DEBUG - File execution results ${fileName}:`);
                this.logger.log(`   stdout: ${stdout.length} characters`);
                this.logger.log(`   stderr: ${stderr.length} characters`);
                if (error) {
                    this.logger.logError(output, error);
                }
				// this.logger.log(output);
                
                // Process results for each method in the file
                for (const method of methodsFromFile) {
                    let status = TestStatus.Unknown;
                    let errorMessage = '';
                    
                    // Simplified parsing logic (can be improved)
                    if (output.includes(`${method.name} ...`) || output.includes(`${method.name}:`)) {
                        if (output.includes('OK') && !output.includes('FAILURES') && !output.includes('ERRORS')) {
                            status = TestStatus.Passed;
                        } else if (output.includes('FAILURES') || output.includes('ERRORS') || output.includes('FAILED')) {
                            status = TestStatus.Failed;
                            // Extract error message if possible
                            const errorLines = output.split('\n').filter(line => 
                                line.includes('AssertionFailedError') || 
                                line.includes('Failed asserting') ||
                                line.includes('Exception:')
                            );
                            if (errorLines.length > 0) {
                                errorMessage = errorLines[0].trim();
                            }
                        }
                    } else if (error) {
						status = TestStatus.Failed;
					} else {
						status = TestStatus.Passed;
					}
                    
                    // Update method status
                    method.status = status;
                    method.lastRun = new Date();
                    // method.errorMessage = errorMessage;
                    method.errorMessage = output;
                    
                    this.logger.log(`   📋 ${method.name}: ${status}${errorMessage ? ` - ${errorMessage}` : ''}`);
                    
                    // Notify update via callback
					if (onTestUpdate) {
						onTestUpdate({
							...method,
							status: status,
							lastRun: new Date(),
							errorMessage: output
						});
					}
                }
                
                const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
                const message = `Tests executed for ${fileName}${dockerInfo}`;
                this.logger.log(`✅ DEBUG - ${message}`);
                vscode.window.showInformationMessage(message);
            });

            this.logger.log(`🚀 DEBUG runTestFile - Initialization complete`);
        } catch (error) {
            this.logger.log(`❌ DEBUG runTestFile - Error: ${error}`);
            vscode.window.showErrorMessage(`Error during execution: ${error}`);
        }
    }

    /**
     * Execute a test with output capture for result analysis
     */
    private executeTestWithCapture(command: string, cwd: string, testMethod: TestMethod, onTestUpdate?: (testMethod: TestMethod) => void): void {
        
        // Execute in background with output capture for error details
        exec(command, { cwd }, (error, stdout, stderr) => {
            const output = stdout + stderr;
            
            // Log execution details
            this.logger.log(`📊 Execution details for ${testMethod.className}::${testMethod.name}:`);
            if (error) {
                this.logger.log(`   ⚠️ Execution error: ${error.message}`);
                this.logger.log(`   🔢 Exit code: ${error.code || 'undefined'}`);
            }
            this.logger.log(`   📤 stdout: ${stdout.length} characters`);
            this.logger.log(`   📥 stderr: ${stderr.length} characters`);
            this.logger.log('');
            
            // Parse output to determine status and extract error details
            let status = TestStatus.Unknown;
            let errorMessage = '';
            let failureDetails = '';
            
            if (output.includes('OK (')) {
                status = TestStatus.Passed;
                this.logger.log(`   ✅ Test passed`);
            } else if (output.includes('FAILURES!') || output.includes('ERRORS!') || error) {
                status = TestStatus.Failed;
                this.logger.log(`   ❌ Test failed`);
                
                // Extract more precise error details
                const lines = output.split('\n');
                let captureNext = false;
                let errorSection = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Detect error sections
                    if (line.includes('FAILURES:') || line.includes('ERRORS:')) {
                        captureNext = true;
                        continue;
                    }
                    
                    if (captureNext) {
                        if (line.trim() === '' && errorSection.length > 0) {
                            break; // End of error section
                        }
                        if (line.trim() !== '') {
                            errorSection.push(line);
                        }
                        // Limit to 5 lines to avoid too verbose output
                        if (errorSection.length >= 5) {
                            break;
                        }
                    }
                }
                
                if (errorSection.length > 0) {
                    errorMessage = errorSection[0].replace(/^\d+\)\s*/, '').trim();
                    failureDetails = errorSection.slice(0, 3).join('\n');
                    this.logger.log(`   📝 Error message: ${errorMessage}`);
                    this.logger.log(`   📄 Raw PHPUnit output:`);
                    errorSection.slice(0, 3).forEach(line => this.logger.log(`      ${line}`));
                } else if (error) {
                    errorMessage = error.message;
                    this.logger.log(`   💥 Execution error: ${errorMessage}`);
                }
            } else {
                this.logger.log(`   ❓ Undetermined status, output to analyze`);
            }
            
            // Update TestMethod with collected information
            testMethod.status = status;
			this.logger.logDebug(`Test status update: ${testMethod.className}::${testMethod.name} → ${status}`);
            testMethod.lastRun = new Date();
            testMethod.errorMessage = output;
            
            // Display result to user
            const statusIcon = status === TestStatus.Passed ? '✅' : status === TestStatus.Failed ? '❌' : '❓';
            const message = `${statusIcon} Test ${testMethod.className}::${testMethod.name}: ${status}`;
            this.logger.log(`🎯 Final result: ${message}`);
            this.logger.log('');

			if (onTestUpdate) {
				onTestUpdate({
					...testMethod,
					status: status,
					lastRun: new Date(),
					errorMessage: output
				});
			}
			
            
            if (status === TestStatus.Failed && errorMessage) {
                vscode.window.showErrorMessage(`${message} - ${errorMessage}`);
            } else {
                vscode.window.showInformationMessage(message);
            }
        });
    }

    /**
     * Execute a collection without capture (direct display in terminal)
     */
    private executeCollectionWithoutCapture(command: string, cwd: string, collection: TestCollection): void {
        const terminal = this.getOrCreateTerminal(collection.name);
        terminal.show();
        terminal.sendText(command);
    }

    /**
     * Configure test status manually
     */
    async setTestStatusManually(testMethod: TestMethod): Promise<void> {
        const statusOptions = [
            { label: '✅ Passed', value: TestStatus.Passed },
            { label: '❌ Failed', value: TestStatus.Failed }, 
            { label: '⏭️ Skipped', value: TestStatus.Skipped },
            { label: '❓ Unknown', value: TestStatus.Unknown }
        ];

        const selectedOption = await vscode.window.showQuickPick(statusOptions, {
            placeHolder: `Set status for ${testMethod.className}::${testMethod.name}`
        });

        if (selectedOption) {
            testMethod.status = selectedOption.value;
            testMethod.lastRun = new Date();
            
            // Custom error message if failed
            if (selectedOption.value === TestStatus.Failed) {
                const errorMessage = await vscode.window.showInputBox({
                    prompt: 'Error message (optional)',
                    placeHolder: 'Enter error message...'
                });
                
                if (errorMessage) {
                    testMethod.errorMessage = errorMessage;
                }
            } else {
                testMethod.errorMessage = undefined;
            }
            
            this.logger.logSuccess(`Manual status set for ${testMethod.className}::${testMethod.name}: ${selectedOption.value}`);
            vscode.window.showInformationMessage(`Status set: ${testMethod.className}::${testMethod.name} → ${selectedOption.label}`);
        }
    }

    /**
     * Build a Docker command if necessary
     */
    private buildDockerCommand(collection: TestCollection, command: string, workspacePath: string): string {
        if (!collection.useDocker || !collection.dockerImage) {
            return command;
        }

        // Build Docker command
        // Format: docker exec image command (without -it to avoid TTY error)
        const dockerCommand = `docker exec ${collection.dockerImage} ${command}`;
        
        this.logger.log(`🐳 Docker transformation for collection "${collection.name}"`);
        this.logger.log(`   Original command: ${command}`);
        this.logger.log(`   Docker command:    ${dockerCommand}`);
        this.logger.log(`   ℹ️  Note: Using without -it for VS Code compatibility`);
        this.logger.log('');
        
        return dockerCommand;
    }

    /**
     * Get or create a terminal for a collection
     */
    private getOrCreateTerminal(collectionName: string): vscode.Terminal {
        let terminal = this.collectionTerminals.get(collectionName);
        if (!terminal || terminal.exitStatus) {
            terminal = vscode.window.createTerminal(`Tests: ${collectionName}`);
            this.collectionTerminals.set(collectionName, terminal);
        }
        return terminal;
    }

    /**
     * Clean up closed terminals
     */
    cleanupClosedTerminals(): void {
        for (const [collectionName, terminal] of this.collectionTerminals.entries()) {
            if (terminal.exitStatus) {
                this.collectionTerminals.delete(collectionName);
            }
        }
    }

    /**
     * Release resources
     */
    dispose(): void {
        // Close all terminals
        for (const terminal of this.collectionTerminals.values()) {
            terminal.dispose();
        }
        this.collectionTerminals.clear();

        // Remove terminal data handlers
        for (const handler of this.terminalDataHandlers.values()) {
            handler.dispose();
        }
        this.terminalDataHandlers.clear();
    }
}