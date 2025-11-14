# 📋 Guide d'utilisation - PHP Test Collections Explorer

## 🎯 Vue d'ensemble

Cette extension VS Code vous permet de :
- ✅ Explorer et organiser vos tests PHP par collections
- 🚀 Exécuter des tests individuels, par fichier ou par collection
- 🐳 Supporter l'exécution dans des conteneurs Docker
- 📊 Visualiser les statuts des tests avec des icônes
- 🔍 Voir les détails des erreurs directement dans l'éditeur

## 📥 Installation

### Méthode 1: Installation depuis le fichier VSIX
1. Téléchargez le fichier `tests-vs-extension-0.0.1.vsix`
2. Dans VS Code : `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Sélectionnez le fichier VSIX

### Méthode 2: Ligne de commande
```bash
code --install-extension tests-vs-extension-0.0.1.vsix
```

## 🛠️ Configuration de votre projet

### 1. Structure de projet supportée
L'extension fonctionne avec tout projet PHP qui utilise PHPUnit. Structure typique :
```
mon-projet/
├── tests/
│   ├── Unit/
│   │   ├── UserTest.php
│   │   └── ProductTest.php
│   ├── Feature/
│   │   ├── LoginTest.php
│   │   └── ApiTest.php
│   └── Integration/
│       └── DatabaseTest.php
├── vendor/
└── phpunit.xml
```

### 2. Configuration automatique
Au premier démarrage, l'extension créera automatiquement 3 collections par défaut :
- **Unit Tests** - tests/Unit
- **Feature Tests** - tests/Feature  
- **Docker Integration Tests** - tests/Integration (avec Docker)

### 3. Configuration personnalisée
Pour configurer vos propres collections :

#### Via l'interface
1. **Vue "PHP Test Collections"** → Clic droit → **"Add Test Collection"**
2. Remplir les informations :
   - **Nom** : ex. "API Tests"
   - **Chemin** : ex. "tests/Api" 
   - **Commande** : ex. "vendor/bin/phpunit tests/Api"
   - **Docker** : Oui/Non + nom de l'image

#### Via settings.json
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit --testsuite unit tests/Unit",
      "pattern": "**/*Test.php",
      "useDocker": false
    },
    {
      "name": "Integration Docker",
      "path": "tests/Integration", 
      "command": "./tests/vendor/phpunit/phpunit/phpunit --configuration tests/Integration/phpunit.xml.dist tests/Integration",
      "pattern": "**/*Test.php",
      "useDocker": true,
      "dockerImage": "mon-app"
    }
  ]
}
```

## 🎮 Utilisation

### 📁 Vue "PHP Test Collections"
L'extension ajoute une nouvelle vue dans l'Explorateur de fichiers :

```
🐳 Docker Integration Tests (5 files)
├── ✅ AuthTest.php (3 tests)
│   ├── ✅ testLogin
│   ├── ❌ testFailedLogin  
│   └── ⚪ testLogout
├── ❌ DatabaseTest.php (2 tests)
└── ...

Unit Tests (8 files)
├── ✅ UserTest.php (4 tests)
└── ...
```

### 🎯 Types d'exécution

#### 1. Test individuel
- **Clic droit** sur un test → **"▶️"** 
- Exécute uniquement ce test avec `--filter "ClassName::testMethod"`

#### 2. Tous les tests d'un fichier
- **Clic droit** sur un fichier → **"▶️"** 
- Exécute tous les tests de la classe avec `--filter "ClassName"`

#### 3. Collection complète
- **Clic droit** sur une collection → **"▶️"**
- Exécute toute la suite de tests

### 🐳 Support Docker

#### Configuration Docker
```json
{
  "name": "Tests API Docker",
  "path": "tests/Api",
  "command": "./tests/vendor/phpunit/phpunit/phpunit --configuration tests/phpunit.xml.dist",
  "useDocker": true,
  "dockerImage": "mon-app"
}
```

#### Commandes générées
- **Local** : `vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php`
- **Docker** : `docker exec mon-app vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php`

### 📊 Statuts des tests

| Icône | Statut | Description |
|-------|--------|-------------|
| ✅ | Réussi | Test passé avec succès |
| ❌ | Échec | Test échoué (assertion failed) |
| 💥 | Erreur | Erreur PHP (fatal error, exception) |
| ⏭️ | Ignoré | Test ignoré (@skip, markTestSkipped) |
| 🔄 | En cours | Test en cours d'exécution |
| ⚪ | Inconnu | Statut non déterminé |

### 🔍 Détails des erreurs

#### Affichage automatique
Les tests échoués montrent automatiquement :
- 📝 Message d'erreur court
- 📄 Détails complets de l'échec
- 🕐 Horodatage de la dernière exécution

#### Consultation détaillée
- **Clic droit** sur un test échoué → **"Show Error Details"**
- Ouvre un nouveau fichier avec tous les détails d'erreur

### 📋 Logs et debugging

#### Onglet Output dédié
- **Vue Tests** → **"📤 Show Logs"**
- Affiche toutes les commandes exécutées avec timestamps
- Idéal pour débugger les problèmes Docker ou PHPUnit

#### Exemple de log
```
[14:23:45] 📝 Exécution du test: UserTest::testLogin
           Commande: docker exec mon-app vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php

[14:23:46] ✅ Résultat du test UserTest::testLogin: ✅ Réussi
```

## ⚡ Optimisations

### Cache intelligent
- **Cache automatique** : Les tests sont scannés et mis en cache
- **Mise à jour** : Rafraîchissement automatique quand les fichiers changent
- **Force refresh** : Bouton "🔄" pour vider le cache

### Terminaux dédiés
- **Un terminal par collection** : Organisation claire
- **Réutilisation** : Les terminaux existants sont réutilisés
- **Nettoyage automatique** : Suppression des terminaux fermés

## 🔧 Dépannage

### Problèmes courants

#### "Aucune donnée en cache"
**Solution** : Clic sur "🔄 Refresh" dans la vue Tests

#### "Commande Docker échoue"
**Vérifications** :
1. Le conteneur Docker est-il démarré ?
2. Le nom de l'image est-il correct dans la configuration ?
3. Consulter l'onglet Output pour voir la commande exacte

#### "Aucun test détecté"
**Vérifications** :
1. Le chemin de la collection est-il correct ?
2. Les fichiers se terminent-ils par `Test.php` ?
3. Les méthodes commencent-elles par `test` ou ont-elles `@test` ?

### Commandes de débogage

#### Vérifier la configuration
```bash
# Dans le terminal VS Code
echo "Configuration collections:"
cat .vscode/settings.json | grep -A 20 phpTestCollections
```

#### Tester manuellement
```bash
# Exemple de test d'une commande Docker
docker exec mon-app vendor/bin/phpunit --version
docker exec mon-app vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php
```

## 📚 Exemples de configuration

### Projet Laravel standard
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Feature Tests",
      "path": "tests/Feature", 
      "command": "vendor/bin/phpunit --testsuite=Feature",
      "useDocker": false
    },
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit --testsuite=Unit", 
      "useDocker": false
    }
  ]
}
```

### Projet avec Docker Compose
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Tests dans Container",
      "path": "tests",
      "command": "vendor/bin/phpunit --configuration phpunit.xml",
      "useDocker": true,
      "dockerImage": "mon-projet_app"
    }
  ]
}
```

### Projet multi-environnements
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Tests Locaux",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit",
      "useDocker": false
    },
    {
      "name": "Tests Integration (Docker)",
      "path": "tests/Integration", 
      "command": "./scripts/test-integration.sh",
      "useDocker": true,
      "dockerImage": "integration-env"
    },
    {
      "name": "Tests E2E",
      "path": "tests/E2E",
      "command": "vendor/bin/phpunit --group=e2e tests/E2E",
      "useDocker": false
    }
  ]
}
```

## 📞 Support

### Informations utiles
- **Version** : 0.0.1
- **Compatibilité** : VS Code 1.105.0+
- **Technologies** : TypeScript, PHPUnit, Docker
- **Taille** : ~16.5KB

### Logs d'extension
En cas de problème, consultez :
1. **Output** → "PHP Test Collections" (logs de l'extension)
2. **Developer Tools** → Console (erreurs JavaScript)
3. **Terminal** → Vérifier les commandes manuellement

---

🎉 **Bonne utilisation de votre extension PHP Test Collections Explorer !**