# PHP Test Collections Explorer

Extension VS Code spécialisée pour gérer et exécuter des collections de tests PHP. Cette extension permet d'organiser vos tests en collections configurables avec des commandes d'exécution personnalisées.

## Fonctionnalités

### � Collections de Tests
- **Organisation par collections** : Groupez vos tests logiquement (Unit, Feature, Integration, etc.)
- **Configuration flexible** : Définissez le chemin, la commande et les patterns pour chaque collection
- **Exécution directe** : Lancez vos tests directement depuis l'interface
- **Compteurs en temps réel** : Voyez le nombre de tests par collection

### 🎯 Support PHP/PHPUnit
- **Patterns PHP** : Détection automatique des fichiers `*Test.php`
- **Commandes PHPUnit** : Support des commandes `vendor/bin/phpunit`, `composer test`, etc.
- **Exclusions intelligentes** : Ignore automatiquement le dossier `vendor/`

### ⚙️ Commandes disponibles
- **Add Test Collection** : Ajouter une nouvelle collection
- **Run Test Collection** : Exécuter tous les tests d'une collection
- **Run Test** : Exécuter un test individuel spécifique
- **Refresh Tests** : Actualiser la liste des tests
- **Configure Collections** : Ouvrir les paramètres de configuration
- **Open Test File** : Ouvrir directement un fichier de test

### 🎯 Tests individuels
- **Parsing automatique** : Détection des méthodes `testXxx()` et `@test`
- **Vue hiérarchique** : Collection → Fichier → Méthodes de test
- **Exécution ciblée** : Bouton ▶️ sur chaque test individuel
- **Support annotations** : Détection des méthodes avec `@test`

### 🖥️ Gestion intelligente des terminaux
- **Terminal unique par collection** : Réutilise le même terminal pour tous les tests d'une collection
- **Nettoyage automatique** : Détection et suppression des terminaux fermés
- **Nommage clair** : Terminaux nommés `Tests: [Collection Name]`
- **Réutilisation** : Les tests individuels utilisent le terminal de leur collection

### ⚡ Système de cache et d'état
- **Cache persistant** : Stockage des tests découverts pour un chargement plus rapide
- **États de test** : Suivi du statut de chaque test (✅ Passé, ❌ Échoué, 🔄 En cours)
- **Indicateurs visuels** : Icônes colorées pour identifier rapidement l'état des tests
- **Optimisation** : Refresh automatique du cache toutes les 5 minutes seulement

### 📊 États des tests disponibles
- ⚪ **Unknown** : Test jamais exécuté ou statut inconnu
- 🔄 **Running** : Test en cours d'exécution
- ✅ **Passed** : Test réussi lors de la dernière exécution
- ❌ **Failed** : Test échoué avec assertion failed
- 💥 **Error** : Test avec erreur (exception, erreur fatale)
- ⏭️ **Skipped** : Test ignoré

### 🔧 Collections par défaut
L'extension vient préconfigurée avec :
- **Unit Tests** : `tests/Unit/` avec `vendor/bin/phpunit tests/Unit`
- **Feature Tests** : `tests/Feature/` avec `vendor/bin/phpunit tests/Feature`

### 📋 Structure d'affichage
```
📚 Unit Tests (2 files)
├── 📄 CalculatorTest.php (6 tests)
│   ├── 🧪 testAddition
│   ├── 🧪 testSubtraction  
│   ├── 🧪 testMultiplication
│   ├── 🧪 testDivision
│   ├── 🧪 testModulo
│   └── 🧪 powerOperation (@test)
└── 📄 StringUtilsTest.php (4 tests)
    ├── 🧪 testStringLength
    ├── 🧪 testStringUppercase
    ├── 🧪 testStringLowercase
    └── 🧪 testStringReverse
```

# PHP Test Collections Explorer

Une extension VS Code pour explorer, organiser et exécuter vos tests PHP avec support Docker complet.

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0+-green)
![PHP](https://img.shields.io/badge/PHP-PHPUnit-purple)
![Docker](https://img.shields.io/badge/Docker-Supported-blue)

## ✨ Fonctionnalités

- 📁 **Organisation par collections** - Groupez vos tests par dossier (Unit, Feature, Integration...)
- 🎯 **Exécution granulaire** - Tests individuels, par fichier ou collection complète
- 🐳 **Support Docker natif** - Exécution transparente dans les conteneurs
- 📊 **Statuts visuels** - Icônes pour les tests réussis/échoués/en cours
- 🔍 **Détails d'erreur** - Visualisation complète des échecs et erreurs PHP
- ⚡ **Cache intelligent** - Scan optimisé avec mise à jour automatique
- 📋 **Logging complet** - Toutes les commandes dans un onglet Output dédié

## 🚀 Installation rapide

1. **Télécharger** : `tests-vs-extension-0.0.1.vsix`
2. **VS Code** : `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. **Ouvrir** un projet PHP avec tests
4. **Vue "PHP Test Collections"** apparaît automatiquement

## 🎮 Utilisation

### Vue d'arbre intuitive
```
🐳 Docker Integration Tests (5 files)
├── ✅ AuthTest.php (3 tests)
│   ├── ✅ testLogin
│   ├── ❌ testFailedLogin  
│   └── ⚪ testLogout
└── ✅ DatabaseTest.php (2 tests)

Unit Tests (8 files)
├── ✅ UserTest.php (4 tests)
└── ...
```

### Configuration simple
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit",
      "useDocker": false
    },
    {
      "name": "Integration Docker",
      "path": "tests/Integration",
      "command": "vendor/bin/phpunit tests/Integration", 
      "useDocker": true,
      "dockerImage": "mon-app"
    }
  ]
}
```

### Types d'exécution

| Action | Résultat | Commande générée |
|--------|----------|------------------|
| ▶️ Test individuel | `testLogin` seulement | `--filter "UserTest::testLogin"` |
| ▶️ Fichier complet | Tous tests du fichier | `--filter "UserTest"` |  
| ▶️ Collection | Toute la suite | Commande complète |

## 🐳 Support Docker

Transformation automatique des commandes :
- **Local** : `vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php`
- **Docker** : `docker exec mon-app vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php`

## 📊 Statuts des tests

| Icône | Statut | Description |
|-------|--------|-------------|
| ✅ | Réussi | Test passé |
| ❌ | Échec | Assertion échouée |
| 💥 | Erreur | Erreur PHP |
| 🔄 | En cours | Exécution |
| ⚪ | Inconnu | Non testé |

## 🔧 Configuration avancée

### Projet Laravel
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Feature Tests",
      "path": "tests/Feature",
      "command": "vendor/bin/phpunit --testsuite=Feature"
    },
    {
      "name": "Unit Tests", 
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit --testsuite=Unit"
    }
  ]
}
```

### Docker Compose
```json
{
  "name": "Tests Container",
  "path": "tests",
  "command": "vendor/bin/phpunit",
  "useDocker": true,
  "dockerImage": "mon-projet_app"
}
```

## 📋 Logs et débogage

- **Onglet Output** : "PHP Test Collections"  
- **Commandes tracées** avec timestamps
- **Erreurs Docker** détaillées
- **Force refresh** : Bouton 🔄

## 🛠️ Développement

```bash
# Cloner le repo
git clone [votre-repo]
cd Tests-vs-ext

# Installer les dépendances
npm install

# Compiler
npm run compile

# Lancer en mode dev
F5 (Extension Development Host)

# Créer le package
vsce package
```

## 📚 Documentation

- [Guide d'utilisation complet](./GUIDE-UTILISATION.md)
- [Configuration Docker](./GUIDE-UTILISATION.md#-support-docker)
- [Dépannage](./GUIDE-UTILISATION.md#-dépannage)

## 🎯 Cas d'usage

✅ **Développeur PHP** travaillant avec PHPUnit  
✅ **Projets Laravel/Symfony** avec tests organisés  
✅ **Environnements Docker** pour l'intégration  
✅ **Tests E2E** avec configurations complexes  
✅ **Équipes** ayant besoin de cohérence dans l'exécution des tests  

## 📞 Support

- 📋 **Logs** : Output → "PHP Test Collections"
- 🔍 **Débogage** : Consulter le guide d'utilisation
- 🐛 **Issues** : [Créer une issue](../../issues)

---

🚀 **Transformez votre workflow de test PHP avec une interface visuelle puissante !**

## Prérequis

- VS Code version ^1.105.0
- Node.js et npm pour le développement

## Développement

### Installation des dépendances
```bash
npm install
```

### Compilation
```bash
npm run compile
```

### Tests
```bash
npm test
```

## Configuration

### Structure de collection
```json
{
  "name": "Unit Tests",
  "path": "tests/Unit",
  "command": "vendor/bin/phpunit tests/Unit",
  "pattern": "**/*Test.php"
}
```

### Paramètres disponibles
- `phpTestCollections.collections` : Array des collections configurées

## Utilisation

1. **Installation** : L'extension s'active automatiquement dans les projets PHP
2. **PHP Test Collections** : Nouvelle section dans l'explorateur VS Code
3. **Navigation** : 
   - Cliquez sur une collection pour voir ses tests
   - Cliquez sur un fichier pour l'ouvrir
   - Utilisez l'icône ▶️ pour exécuter une collection
4. **Ajout de collections** : Bouton ➕ pour ajouter rapidement une nouvelle collection

## Exemples d'usage

### Projet Laravel
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "php artisan test --testsuite=Unit"
    },
    {
      "name": "Feature Tests", 
      "path": "tests/Feature",
      "command": "php artisan test --testsuite=Feature"
    }
  ]
}
```

### Projet Symfony
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit"
    },
    {
      "name": "Integration Tests",
      "path": "tests/Integration", 
      "command": "vendor/bin/phpunit tests/Integration"
    }
  ]
}
```

### Lancement en mode développement
1. Ouvrez le projet dans VS Code
2. Appuyez sur `F5` pour lancer l'extension en mode debug
3. Dans la nouvelle fenêtre, "PHP Test Collections" apparaît dans l'explorateur

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
