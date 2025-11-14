// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TestExplorerProvider } from './testExplorer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Test Explorer Extension is now active!');
	vscode.window.showInformationMessage('Test Explorer Extension activated!');

	// Créer le provider pour l'explorateur de tests
	const testExplorerProvider = new TestExplorerProvider(context);

	// Créer la vue d'arbre
	const testExplorerView = vscode.window.createTreeView('testExplorer', {
		treeDataProvider: testExplorerProvider,
		showCollapseAll: true
	});

	// Commande Hello World (garder pour la compatibilité)
	const helloWorldDisposable = vscode.commands.registerCommand('tests-vs-extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Test Explorer Extension!');
	});

	// Commande pour rafraîchir le cache forcément
	const forceRefreshDisposable = vscode.commands.registerCommand('tests-vs-extension.forceRefresh', () => {
		testExplorerProvider.forceRefresh();
	});

	// Commande pour ouvrir un fichier de test
	const openTestFileDisposable = vscode.commands.registerCommand('tests-vs-extension.openTestFile', (testItem) => {
		testExplorerProvider.openTestFile(testItem.resourceUri);
	});

	// Commande pour configurer les collections de test
	const configureTestFoldersDisposable = vscode.commands.registerCommand('tests-vs-extension.configureTestFolders', () => {
		testExplorerProvider.configureTestFolders();
	});

	// Commande pour exécuter une collection de tests
	const runTestCollectionDisposable = vscode.commands.registerCommand('tests-vs-extension.runTestCollection', (item: any) => {
		if (item && item.collection) {
			testExplorerProvider.runTestCollection(item.collection);
		}
	});

	// Commande pour ajouter une nouvelle collection
	const addTestCollectionDisposable = vscode.commands.registerCommand('tests-vs-extension.addTestCollection', () => {
		testExplorerProvider.addTestCollection();
	});

	// Commande pour exécuter un test individuel
	const runSingleTestDisposable = vscode.commands.registerCommand('tests-vs-extension.runSingleTest', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.runSingleTest(item.testMethod);
		}
	});

	// Commande pour définir manuellement le statut d'un test
	const setTestStatusDisposable = vscode.commands.registerCommand('tests-vs-extension.setTestStatus', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.setTestStatusManually(item.testMethod);
		}
	});

	// Commande pour afficher les détails d'erreur d'un test
	const showErrorDetailsDisposable = vscode.commands.registerCommand('tests-vs-extension.showErrorDetails', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.showTestErrorDetails(item.testMethod);
		}
	});

	// Commande pour afficher l'onglet Output
	const showOutputDisposable = vscode.commands.registerCommand('tests-vs-extension.showOutput', () => {
		testExplorerProvider.showOutput();
	});

	// Commande pour exécuter tous les tests d'un fichier
	const runTestFileDisposable = vscode.commands.registerCommand('tests-vs-extension.runTestFile', (item: any) => {
		if (item && item.resourceUri) {
			testExplorerProvider.runTestFile(item.resourceUri, item.collection);
		}
	});

	// Ajouter toutes les disposables au contexte
	context.subscriptions.push(
		helloWorldDisposable,
		forceRefreshDisposable,
		openTestFileDisposable,
		configureTestFoldersDisposable,
		runTestCollectionDisposable,
		addTestCollectionDisposable,
		runSingleTestDisposable,
		setTestStatusDisposable,
		showErrorDetailsDisposable,
		showOutputDisposable,
		runTestFileDisposable,
		testExplorerView,
		testExplorerProvider
	);

	// Scanner les tests au démarrage
	testExplorerProvider.refresh();
}

// This method is called when your extension is deactivated
export function deactivate() {}
