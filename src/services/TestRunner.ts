import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { TestCollection, TestMethod, TestStatus, CachedCollection } from '../types';
import { LoggingService } from './LoggingService';

/**
 * Service de gestion de l'exécution des tests PHPUnit
 * 
 * Gère l'exécution des tests individuels, collections, et parsing des résultats
 * avec support Docker et capture d'output.
 */
export class TestRunner {
    private readonly logger: LoggingService;
    private collectionTerminals: Map<string, vscode.Terminal> = new Map();
    private terminalDataHandlers: Map<string, vscode.Disposable> = new Map();

    constructor(logger: LoggingService) {
        this.logger = logger;
    }

    /**
     * Exécute tous les tests d'une collection
     */
    async runTestCollection(collection: TestCollection): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('Aucun workspace ouvert');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            
            // Construire la commande avec Docker si nécessaire
            const finalCommand = this.buildDockerCommand(collection, collection.command, workspaceFolder.uri.fsPath);
            
            // Logger la commande
            this.logger.logCommand(`Exécution de la collection: ${collection.name}`, finalCommand);
            
            // Exécuter la commande directement dans le terminal (sans mise à jour des statuts)
            this.executeCollectionWithoutCapture(finalCommand, workspaceFolder.uri.fsPath, collection);
            
            const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
            vscode.window.showInformationMessage(`Exécution des tests: ${collection.name}${dockerInfo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur: ${error}`);
        }
    }

    /**
     * Exécute un test individuel avec capture d'output pour parsing du résultat
     */
    async runTestMethod(testMethod: TestMethod): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('Aucun workspace ouvert');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];

            // Construire la commande PHPUnit pour un test spécifique
            // Format: vendor/bin/phpunit --filter "TestClass::testMethod" [autres options] path/to/file
            const collection = testMethod.collection;
            
            // Parser la commande de base pour séparer la commande PHPUnit, les options et le chemin
            const baseCommand = collection.command;
            
            // Construire la commande finale avec le filtre
            const filterOption = `--filter "${testMethod.className}::${testMethod.name}"`;
            let finalCommand = `${baseCommand} ${filterOption}`;
            
            // Ajouter le chemin du fichier à la fin
            const relativePath = path.relative(workspaceFolder.uri.fsPath, testMethod.filePath);
            finalCommand += ` ${relativePath}`;
            
            // Appliquer Docker si nécessaire
            finalCommand = this.buildDockerCommand(collection, finalCommand, workspaceFolder.uri.fsPath);
            
            // Logger la commande
            this.logger.logCommand(`Exécution test: ${testMethod.className}::${testMethod.name}`, finalCommand);
            
            // Exécuter avec capture pour parser le résultat
            this.executeTestWithCapture(finalCommand, workspaceFolder.uri.fsPath, testMethod);
            
            const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
            vscode.window.showInformationMessage(`Exécution du test: ${testMethod.name}${dockerInfo}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur: ${error}`);
        }
    }

    /**
     * Exécute un fichier de test complet
     */
    async runTestFile(
        fileUri: vscode.Uri, 
        collection: TestCollection, 
        cachedCollections: Map<string, CachedCollection>,
        onTestUpdate?: (testMethod: TestMethod) => void
    ): Promise<void> {
        // 🔍 Début du debug de runTestFile
        this.logger.log(`🚀 DEBUG runTestFile - Démarrage`);
        this.logger.log(`   📂 Fichier: ${fileUri.fsPath}`);
        this.logger.log(`   📦 Collection: ${collection.name}`);
        this.logger.log(`   🐳 Docker: ${collection.useDocker ? `Oui (${collection.dockerImage})` : 'Non'}`);
        this.logger.log('');

        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                this.logger.log(`❌ DEBUG - Aucun workspace ouvert`);
                vscode.window.showErrorMessage('Aucun workspace ouvert');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            this.logger.log(`📁 DEBUG - Workspace: ${workspaceFolder.uri.fsPath}`);

            // Extraire le nom de la classe à partir du chemin du fichier
            const fileName = path.basename(fileUri.fsPath, '.php');
            this.logger.log(`📄 DEBUG - Nom du fichier: ${fileName}`);
            
            // Chercher dans le cache des méthodes pour trouver la classe correspondante à ce fichier
            const cachedData = cachedCollections.get(collection.name);
            this.logger.log(`💾 DEBUG - Cache trouvé: ${cachedData ? 'Oui' : 'Non'}`);
            if (cachedData) {
                this.logger.log(`   Total méthodes en cache: ${cachedData.methods.length}`);
                this.logger.log(`   Dernière mise à jour cache: ${cachedData.lastScan}`);
            }
            
            if (!cachedData) {
                this.logger.log(`❌ DEBUG - Aucune donnée en cache pour la collection: ${collection.name}`);
                vscode.window.showErrorMessage('Aucune donnée en cache pour cette collection. Veuillez actualiser la vue.');
                return;
            }

            // Trouver la première méthode de ce fichier pour obtenir le nom de classe
            const methodsFromFile = cachedData.methods.filter((method: TestMethod) => method.filePath === fileUri.fsPath);
            this.logger.log(`🔍 DEBUG - Recherche méthodes dans le fichier:`);
            this.logger.log(`   Chemin recherché: ${fileUri.fsPath}`);
            this.logger.log(`   Méthodes trouvées: ${methodsFromFile.length}`);
            
            if (methodsFromFile.length > 0) {
                this.logger.log(`   Première méthode: ${methodsFromFile[0].className}::${methodsFromFile[0].name}`);
                methodsFromFile.forEach((method, index) => {
                    this.logger.log(`   [${index}] ${method.className}::${method.name} (${method.filePath})`);
                });
            }

            if (methodsFromFile.length === 0) {
                this.logger.log(`❌ DEBUG - Aucune méthode trouvée dans ce fichier`);
                vscode.window.showErrorMessage('Aucune méthode de test trouvée dans ce fichier.');
                return;
            }

            const className = methodsFromFile[0].className;
            this.logger.log(`🏷️ DEBUG - Nom de classe extrait: ${className}`);

            // Parser la commande de base pour séparer la commande PHPUnit, les options et le chemin
            const baseCommand = collection.command;
            this.logger.log(`📋 DEBUG - Commande de base: ${baseCommand}`);
            
            let phpunitCommand = '';
            let phpunitOptions = '';
            let foundPhpunit = false;
            
            // Découper la commande pour extraire le chemin vers phpunit et les options
            this.logger.log(`🔧 DEBUG - Parsing de la commande:`);
            const parts = baseCommand.split(' ');
            for (let i = 0; i < parts.length; i++) {
                if (parts[i].includes('phpunit')) {
                    phpunitCommand = parts.slice(0, i + 1).join(' ');
                    phpunitOptions = parts.slice(i + 1).join(' ');
                    foundPhpunit = true;
                    this.logger.log(`     → PHPUnit trouvé: "${phpunitCommand}"`);
                    this.logger.log(`     → Options: "${phpunitOptions}"`);
                    break;
                }
            }
            
            if (!foundPhpunit) {
                this.logger.log(`     → PHPUnit non trouvé, utilisation commande complète`);
                phpunitCommand = baseCommand;
            }
            
            // Construire la commande finale avec le filtre pour la classe
            const filterOption = `--filter "${className}"`;
            let finalCommand = `${phpunitCommand} ${filterOption}`;
            
            if (phpunitOptions) {
                finalCommand += ` ${phpunitOptions}`;
            }
            
            // Ajouter le chemin du fichier à la fin
            const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
            finalCommand += ` ${relativePath}`;
            this.logger.log(`🔨 DEBUG - Commande avant Docker: ${finalCommand}`);
            
            // Appliquer Docker si nécessaire
            finalCommand = this.buildDockerCommand(collection, finalCommand, workspaceFolder.uri.fsPath);
            this.logger.log(`🐳 DEBUG - Commande finale: ${finalCommand}`);
            this.logger.log('');
            
            // Logger la commande
            this.logger.logCommand(`Exécution fichier: ${fileName}`, finalCommand);
            
            // Exécuter avec capture pour traiter chaque méthode individuellement
            exec(finalCommand, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
                const output = stdout + stderr;
                this.logger.log(`📊 DEBUG - Résultats d'exécution du fichier ${fileName}:`);
                this.logger.log(`   stdout: ${stdout.length} caractères`);
                this.logger.log(`   stderr: ${stderr.length} caractères`);
                if (error) {
                    this.logger.log(`   Erreur: ${error.message}`);
                }
                this.logger.log('');
                
                // Traiter les résultats pour chaque méthode du fichier
                for (const method of methodsFromFile) {
                    let status = TestStatus.Unknown;
                    let errorMessage = '';
                    
                    // Logic simplifiée de parsing (peut être améliorée)
                    if (output.includes(`${method.name} ...`) || output.includes(`${method.name}:`)) {
                        if (output.includes('OK') && !output.includes('FAILURES') && !output.includes('ERRORS')) {
                            status = TestStatus.Passed;
                        } else if (output.includes('FAILURES') || output.includes('ERRORS') || output.includes('FAILED')) {
                            status = TestStatus.Failed;
                            // Extraire le message d'erreur si possible
                            const errorLines = output.split('\n').filter(line => 
                                line.includes('AssertionFailedError') || 
                                line.includes('Failed asserting') ||
                                line.includes('Exception:')
                            );
                            if (errorLines.length > 0) {
                                errorMessage = errorLines[0].trim();
                            }
                        }
                    }
                    
                    // Mettre à jour le statut de la méthode
                    method.status = status;
                    method.lastRun = new Date();
                    method.errorMessage = errorMessage;
                    
                    this.logger.log(`   📋 ${method.name}: ${status}${errorMessage ? ` - ${errorMessage}` : ''}`);
                    
                    // Notifier la mise à jour via le callback
					if (onTestUpdate) {
						onTestUpdate({
							...method,
							status: status,
							lastRun: new Date(),
							errorMessage: errorMessage
						});
					}
                }
                
                const dockerInfo = collection.useDocker ? ` 🐳 (Docker: ${collection.dockerImage})` : '';
                const message = `Tests exécutés pour ${fileName}${dockerInfo}`;
                this.logger.log(`✅ DEBUG - ${message}`);
                vscode.window.showInformationMessage(message);
            });

            this.logger.log(`🚀 DEBUG runTestFile - Fin de l'initialisation`);
        } catch (error) {
            this.logger.log(`❌ DEBUG runTestFile - Erreur: ${error}`);
            vscode.window.showErrorMessage(`Erreur lors de l'exécution: ${error}`);
        }
    }

    /**
     * Exécute un test avec capture de sortie pour analyse du résultat
     */
    private executeTestWithCapture(command: string, cwd: string, testMethod: TestMethod): void {
        
        // Exécuter en arrière-plan avec capture de sortie pour les détails d'erreur
        exec(command, { cwd }, (error, stdout, stderr) => {
            const output = stdout + stderr;
            
            // Logger les détails d'exécution
            this.logger.log(`📊 Détails d'exécution pour ${testMethod.className}::${testMethod.name}:`);
            if (error) {
                this.logger.log(`   ⚠️ Erreur d'exécution: ${error.message}`);
                this.logger.log(`   🔢 Code de sortie: ${error.code || 'non défini'}`);
            }
            this.logger.log(`   📤 stdout: ${stdout.length} caractères`);
            this.logger.log(`   📥 stderr: ${stderr.length} caractères`);
            this.logger.log('');
            
            // Parser la sortie pour déterminer le statut et extraire les détails d'erreur
            let status = TestStatus.Unknown;
            let errorMessage = '';
            let failureDetails = '';
            
            if (output.includes('OK (')) {
                status = TestStatus.Passed;
                this.logger.log(`   ✅ Test réussi`);
            } else if (output.includes('FAILURES!') || output.includes('ERRORS!') || error) {
                status = TestStatus.Failed;
                this.logger.log(`   ❌ Test échoué`);
                
                // Extraire les détails d'erreur plus précis
                const lines = output.split('\n');
                let captureNext = false;
                let errorSection = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Détecter les sections d'erreur
                    if (line.includes('FAILURES:') || line.includes('ERRORS:')) {
                        captureNext = true;
                        continue;
                    }
                    
                    if (captureNext) {
                        if (line.trim() === '' && errorSection.length > 0) {
                            break; // Fin de la section d'erreur
                        }
                        if (line.trim() !== '') {
                            errorSection.push(line);
                        }
                        // Limiter à 5 lignes pour éviter un output trop verbeux
                        if (errorSection.length >= 5) {
                            break;
                        }
                    }
                }
                
                if (errorSection.length > 0) {
                    errorMessage = errorSection[0].replace(/^\d+\)\s*/, '').trim();
                    failureDetails = errorSection.slice(0, 3).join('\n');
                    this.logger.log(`   📝 Message d'erreur: ${errorMessage}`);
                    this.logger.log(`   📄 Sortie brute PHPUnit:`);
                    errorSection.slice(0, 3).forEach(line => this.logger.log(`      ${line}`));
                } else if (error) {
                    errorMessage = error.message;
                    this.logger.log(`   💥 Erreur d'exécution: ${errorMessage}`);
                }
            } else {
                this.logger.log(`   ❓ Statut indéterminé, sortie à analyser`);
            }
            
            // Mettre à jour le TestMethod avec les informations collectées
            testMethod.status = status;
			this.logger.logInfo(`   Mise à jour du statut du test: ${testMethod.className}::${testMethod.name} → ${status}`);
            testMethod.lastRun = new Date();
            testMethod.errorMessage = errorMessage;
            
            // Afficher le résultat à l'utilisateur
            const statusIcon = status === TestStatus.Passed ? '✅' : status === TestStatus.Failed ? '❌' : '❓';
            const message = `${statusIcon} Test ${testMethod.className}::${testMethod.name}: ${status}`;
            this.logger.log(`🎯 Résultat final: ${message}`);
            this.logger.log('');
            
            if (status === TestStatus.Failed && errorMessage) {
                vscode.window.showErrorMessage(`${message} - ${errorMessage}`);
            } else {
                vscode.window.showInformationMessage(message);
            }
        });
    }

    /**
     * Exécute une collection sans capture (affichage direct dans terminal)
     */
    private executeCollectionWithoutCapture(command: string, cwd: string, collection: TestCollection): void {
        const terminal = this.getOrCreateTerminal(collection.name);
        terminal.show();
        terminal.sendText(command);
    }

    /**
     * Configure le statut d'un test manuellement
     */
    async setTestStatusManually(testMethod: TestMethod): Promise<void> {
        const statusOptions = [
            { label: '✅ Réussi', value: TestStatus.Passed },
            { label: '❌ Échoué', value: TestStatus.Failed }, 
            { label: '⏭️ Ignoré', value: TestStatus.Skipped },
            { label: '❓ Inconnu', value: TestStatus.Unknown }
        ];

        const selectedOption = await vscode.window.showQuickPick(statusOptions, {
            placeHolder: `Définir le statut pour ${testMethod.className}::${testMethod.name}`
        });

        if (selectedOption) {
            testMethod.status = selectedOption.value;
            testMethod.lastRun = new Date();
            
            // Message d'erreur personnalisé si échec
            if (selectedOption.value === TestStatus.Failed) {
                const errorMessage = await vscode.window.showInputBox({
                    prompt: 'Message d\'erreur (optionnel)',
                    placeHolder: 'Entrez le message d\'erreur...'
                });
                
                if (errorMessage) {
                    testMethod.errorMessage = errorMessage;
                }
            } else {
                testMethod.errorMessage = undefined;
            }
            
            this.logger.logSuccess(`Statut manuel défini pour ${testMethod.className}::${testMethod.name}: ${selectedOption.value}`);
            vscode.window.showInformationMessage(`Statut défini: ${testMethod.className}::${testMethod.name} → ${selectedOption.label}`);
        }
    }

    /**
     * Construit une commande Docker si nécessaire
     */
    private buildDockerCommand(collection: TestCollection, command: string, workspacePath: string): string {
        if (!collection.useDocker || !collection.dockerImage) {
            return command;
        }

        // Construire la commande Docker
        // Format: docker exec image command (sans -it pour éviter l'erreur TTY)
        const dockerCommand = `docker exec ${collection.dockerImage} ${command}`;
        
        this.logger.log(`🐳 Transformation Docker pour la collection "${collection.name}"`);
        this.logger.log(`   Commande originale: ${command}`);
        this.logger.log(`   Commande Docker:    ${dockerCommand}`);
        this.logger.log(`   ℹ️  Note: Utilisation sans -it pour compatibilité VS Code`);
        this.logger.log('');
        
        return dockerCommand;
    }

    /**
     * Obtient ou crée un terminal pour une collection
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
     * Nettoie les terminaux fermés
     */
    cleanupClosedTerminals(): void {
        for (const [collectionName, terminal] of this.collectionTerminals.entries()) {
            if (terminal.exitStatus) {
                this.collectionTerminals.delete(collectionName);
            }
        }
    }

    /**
     * Libère les ressources
     */
    dispose(): void {
        // Fermer tous les terminaux
        for (const terminal of this.collectionTerminals.values()) {
            terminal.dispose();
        }
        this.collectionTerminals.clear();

        // Supprimer les handlers de données de terminal
        for (const handler of this.terminalDataHandlers.values()) {
            handler.dispose();
        }
        this.terminalDataHandlers.clear();
    }
}