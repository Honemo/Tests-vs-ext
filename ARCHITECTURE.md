# 🏗️ Architecture Modulaire - PHP Test Collections Explorer

## 📁 Structure proposée

```
src/
├── extension.ts                 # Point d'entrée principal (reste inchangé)
├── types/
│   ├── index.ts                # Exports de tous les types
│   ├── TestCollection.ts       # Interface TestCollection
│   ├── TestMethod.ts           # Interface TestMethod + TestStatus enum
│   ├── TestFile.ts             # Interface TestFile
│   └── Cache.ts                # Interfaces de cache (CachedCollection, JsonCacheData)
├── providers/
│   ├── TestExplorerProvider.ts # TreeDataProvider principal (logique d'affichage)
│   └── TestItem.ts             # Classe TestItem (éléments d'arbre)
├── services/
│   ├── CacheService.ts         # Gestion du cache JSON
│   ├── TestParser.ts           # Parsing des fichiers PHP
│   ├── TestRunner.ts           # Exécution des tests et Docker
│   ├── StatusManager.ts        # Gestion des statuts (tests, fichiers, collections)
│   └── LoggingService.ts       # Logging et Output channel
├── utils/
│   ├── DockerUtils.ts          # Utilitaires Docker
│   ├── FileUtils.ts            # Utilitaires fichiers
│   └── CommandParser.ts        # Parsing des commandes PHPUnit
└── config/
    └── ConfigManager.ts        # Gestion de la configuration VS Code
```

## 📋 Responsabilités par module

### 🎯 `types/` - Définitions de types
- **TestCollection.ts** : Interface de collection avec Docker
- **TestMethod.ts** : Interface de méthode + enum TestStatus
- **TestFile.ts** : Interface de fichier avec métriques
- **Cache.ts** : Interfaces de cache et JSON

### 🎭 `providers/` - Fournisseurs VS Code
- **TestExplorerProvider.ts** : TreeDataProvider, navigation, refresh
- **TestItem.ts** : Éléments d'arbre avec tooltips et icônes

### ⚙️ `services/` - Services métier
- **CacheService.ts** : Load/save cache, .gitignore management
- **TestParser.ts** : Scan des fichiers PHP, extraction des tests
- **TestRunner.ts** : Exécution des commandes, gestion Docker/local
- **StatusManager.ts** : Mise à jour des statuts à tous niveaux
- **LoggingService.ts** : Output channel, debug logs

### 🛠️ `utils/` - Utilitaires
- **DockerUtils.ts** : Construction des commandes Docker
- **FileUtils.ts** : Opérations sur les fichiers
- **CommandParser.ts** : Parsing et construction des commandes PHPUnit

### 📄 `config/` - Configuration
- **ConfigManager.ts** : Lecture/écriture des settings VS Code

## 🔄 Flux de données

```
Extension.ts
    ↓
TestExplorerProvider.ts (orchestration)
    ↓
├── ConfigManager.ts (config)
├── CacheService.ts (données)
├── TestParser.ts (scan)
├── StatusManager.ts (statuts)
└── TestRunner.ts (exécution)
        ↓
    LoggingService.ts (logs)
```

## 📝 Avantages de cette architecture

### ✅ Séparation des responsabilités
- Chaque fichier a une responsabilité unique et claire
- Plus facile à maintenir et débugger
- Tests unitaires plus simples

### ✅ Réutilisabilité
- Services indépendants réutilisables
- Injection de dépendances possible
- Mockage facile pour les tests

### ✅ Lisibilité
- Fichiers de 100-300 lignes max
- Noms explicites et organisation logique
- Documentation plus facile

### ✅ Extensibilité
- Ajout de nouvelles fonctionnalités plus simple
- Modification d'un service sans impacter les autres
- Support d'autres langages de test possible

## 🚀 Plan de migration

### Phase 1 : Types et interfaces
1. Créer le dossier `types/` avec toutes les interfaces
2. Exporter depuis `types/index.ts`
3. Importer dans `testExplorer.ts`

### Phase 2 : Services de base
1. `LoggingService.ts` - Extraire la gestion des logs
2. `CacheService.ts` - Extraire la gestion du cache
3. `ConfigManager.ts` - Extraire la configuration

### Phase 3 : Services métier
1. `TestParser.ts` - Extraire le parsing
2. `StatusManager.ts` - Extraire la gestion des statuts
3. `TestRunner.ts` - Extraire l'exécution

### Phase 4 : Providers et utils
1. `TestItem.ts` - Extraire la classe
2. `DockerUtils.ts` - Extraire les utilitaires Docker
3. Refactoriser `TestExplorerProvider.ts`

### Phase 5 : Finalisation
1. Tests et validation
2. Documentation
3. Optimisations

## 💡 Exemple concret

### Avant (testExplorer.ts - 1877 lignes)
```typescript
export class TestExplorerProvider implements vscode.TreeDataProvider<TestItem> {
    // 50+ méthodes mélangées
    // Cache, parsing, exécution, logging, Docker, etc.
}
```

### Après (TestExplorerProvider.ts - ~200 lignes)
```typescript
export class TestExplorerProvider implements vscode.TreeDataProvider<TestItem> {
    constructor(
        private cacheService: CacheService,
        private testParser: TestParser,
        private statusManager: StatusManager,
        private testRunner: TestRunner,
        private logger: LoggingService
    ) {}

    // Seulement la logique d'affichage et navigation
    getTreeItem(element: TestItem): vscode.TreeItem { ... }
    getChildren(element?: TestItem): Thenable<TestItem[]> { ... }
    refresh(): void { ... }
}
```

## 🎯 Bénéfices immédiats

1. **Debugging plus facile** : Logs isolés par service
2. **Tests unitaires** : Chaque service testable indépendamment  
3. **Performance** : Services lazy-loaded si nécessaire
4. **Collaboration** : Équipes peuvent travailler sur des services différents
5. **Documentation** : Chaque service bien documenté

## 🤔 Question pour vous

Voulez-vous que je commence la migration ? Je propose de commencer par :

1. **Phase 1** : Extraire les types dans `types/`
2. **LoggingService** : Service le plus indépendant
3. **CacheService** : Souvent utilisé, facile à isoler

Ou préférez-vous une autre approche ?