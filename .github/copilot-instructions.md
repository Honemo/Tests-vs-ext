# Instructions Copilot pour Test Explorer Extension

Cette extension VS Code permet d'explorer et lister les fichiers de test dans un workspace.

## Structure du projet
- `src/extension.ts` : Point d'entrée principal de l'extension
- `src/testExplorer.ts` : Logique du Test Explorer (TreeDataProvider)
- `package.json` : Manifeste avec commandes, vues, et configurations
- `.vscode/` : Configuration VS Code pour le développement
- `webpack.config.js` : Configuration de bundling

## Fonctionnalités principales
- **Test Explorer View** : Vue d'arbre dans l'explorateur VS Code
- **Scan automatique** : Détection des fichiers de test par patterns
- **Configuration flexible** : Dossiers et patterns personnalisables
- **Navigation rapide** : Ouverture directe des fichiers

## Commandes disponibles
- `tests-vs-extension.refreshTests` : Actualise la liste des tests
- `tests-vs-extension.openTestFile` : Ouvre un fichier de test
- `tests-vs-extension.configureTestFolders` : Configure les dossiers
- `tests-vs-extension.helloWorld` : Commande Hello World (legacy)

## Configuration utilisateur
- `testExplorer.testFolders` : Dossiers à scanner
- `testExplorer.testFilePatterns` : Patterns de fichiers de test

## Développement
- Utiliser `F5` pour lancer en mode debug
- Modifier `testExplorer.ts` pour la logique de scan
- Les vues et menus sont configurés dans `package.json`