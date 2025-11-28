// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TestExplorerProvider } from './testExplorer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Create the provider for the test explorer
	const testExplorerProvider = new TestExplorerProvider(context);

	// Create the tree view
	const testExplorerView = vscode.window.createTreeView('testExplorer', {
		treeDataProvider: testExplorerProvider,
		showCollapseAll: true
	});

	// Command to refresh the cache and rescan tests
	const forceRefreshDisposable = vscode.commands.registerCommand('tests-vs-extension.forceRefresh', () => {
		testExplorerProvider.forceRefresh();
	});

	// Command to open a test file
	const openTestFileDisposable = vscode.commands.registerCommand('tests-vs-extension.openTestFile', (testItem) => {
		testExplorerProvider.openTestFile(testItem.resourceUri);
	});

	// Command to configure test collections
	const configureTestFoldersDisposable = vscode.commands.registerCommand('tests-vs-extension.configureTestFolders', () => {
		testExplorerProvider.configureTestFolders();
	});

	// Command to run a test collection
	const runTestCollectionDisposable = vscode.commands.registerCommand('tests-vs-extension.runTestCollection', (item: any) => {
		if (item && item.collection) {
			testExplorerProvider.runTestCollection(item.collection);
		}
	});

	// Command to add a new test collection
	const addTestCollectionDisposable = vscode.commands.registerCommand('tests-vs-extension.addTestCollection', () => {
		testExplorerProvider.addTestCollection();
	});

	// Command to run a single test
	const runSingleTestDisposable = vscode.commands.registerCommand('tests-vs-extension.runSingleTest', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.runSingleTest(item.testMethod);
		}
	});

	// Command to manually set the status of a test
	const setTestStatusDisposable = vscode.commands.registerCommand('tests-vs-extension.setTestStatus', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.setTestStatusManually(item.testMethod);
		}
	});

	// Command to show error details of a test
	const showErrorDetailsDisposable = vscode.commands.registerCommand('tests-vs-extension.showTestDetails', (item: any) => {
		if (item && item.testMethod) {
			testExplorerProvider.showTestResultsDetails(item.testMethod);
		}
	});

	// Command to show the Output tab
	const showOutputDisposable = vscode.commands.registerCommand('tests-vs-extension.showOutput', () => {
		testExplorerProvider.showOutput();
	});

	// Command to run all tests in a file
	const runTestFileDisposable = vscode.commands.registerCommand('tests-vs-extension.runTestFile', (item: any) => {
		if (item && item.resourceUri) {
			testExplorerProvider.runTestFile(item.resourceUri, item.collection);
		}
	});

	// Add all disposables to the context
	context.subscriptions.push(
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
