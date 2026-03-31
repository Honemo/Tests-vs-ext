# 🚀 Guide de Release Automatisée

Ce guide explique comment utiliser le nouveau système CI/CD pour créer automatiquement des releases de votre extension VS Code.

## 📋 Processus de Release

### Option 1: Release Automatisée (Recommandée) 

```bash
# Utilise automatiquement la version du CHANGELOG.md
./scripts/auto-release.sh

# Ou spécifie une version particulière  
./scripts/auto-release.sh 1.2.3
```

Ce script fera automatiquement :
1. ✅ Vérification de l'état du dépôt Git
2. 📝 Mise à jour de `package.json` si nécessaire
3. 🔨 Compilation locale pour vérification
4. 🏷️ Création du tag Git `v1.2.3`
5. 📤 Push du tag vers GitHub
6. 🤖 Déclenchement du workflow CI/CD

### Option 2: Release Manuelle

1. **Préparer la release**
   ```bash
   ./scripts/release.sh 1.2.3
   ```

2. **Créer et pusher le tag**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

## 🤖 Workflow CI/CD Automatique

Quand vous pushez un tag commençant par `v` (ex: `v1.2.3`), le workflow GitHub Actions :

1. 🔄 **Checkout** du code source
2. ⚙️ **Setup** de Node.js 18
3. 📦 **Installation** des dépendances (`npm ci`)
4. 🔨 **Compilation** de l'extension (`npm run package`)  
5. 📋 **Packaging** avec vsce (`vsce package`)
6. 🚀 **Création** de la release GitHub
7. 📎 **Attachement** du fichier `.vsix` à la release

### Contenu de la Release Automatique

- **Titre** : `Release v1.2.3`
- **Description** : Instructions d'installation + lien vers CHANGELOG
- **Artefacts** : Fichier `.vsix` prêt à installer
- **Tag** : Le tag créé (ex: `v1.2.3`)

## 📝 Prérequis

### 1. Format du CHANGELOG.md

Assurez-vous que votre `CHANGELOG.md` contient la nouvelle version :

```markdown
## [1.2.3] - 2026-03-31

### Added
- Nouvelle fonctionnalité X
- Amélioration Y

### Fixed  
- Correction du bug Z
```

### 2. Version dans package.json

La version sera automatiquement mise à jour si nécessaire.

### 3. État du dépôt Git

- Branche `main` ou `master` recommandée
- Aucun changement non committé
- Dépôt à jour avec `origin`

## 🔍 Monitoring

### Suivre le Workflow

1. **Actions GitHub** : [https://github.com/Honemo/Tests-vs-ext/actions](https://github.com/Honemo/Tests-vs-ext/actions)
2. **Releases** : [https://github.com/Honemo/Tests-vs-ext/releases](https://github.com/Honemo/Tests-vs-ext/releases)

### En cas d'échec

1. Vérifiez les logs dans GitHub Actions
2. Les erreurs communes :
   - ❌ Échec de compilation (`npm run package`)
   - ❌ Problème avec `vsce package`
   - ❌ Token GitHub manquant (normalement automatique)

## 📦 Installation de la Release

Les utilisateurs peuvent installer l'extension de plusieurs façons :

### Via le fichier .vsix
```bash
code --install-extension tests-vs-extension-1.2.3.vsix
```

### Via l'interface VS Code
1. Ouvrir VS Code
2. `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Sélectionner le fichier `.vsix` téléchargé

## 🛠 Fichiers du Système CI/CD

- `.github/workflows/release.yml` : Workflow GitHub Actions
- `scripts/auto-release.sh` : Script de release automatisée  
- `scripts/release.sh` : Script de release manuelle existant
- `RELEASE-GUIDE.md` : Ce guide (documentation)

## 🔧 Configuration Avancée

### Modifier le Workflow

Éditez `.github/workflows/release.yml` pour :
- Changer les triggers (autres patterns de tags)
- Ajouter des étapes (tests, linting, etc.)
- Modifier la description de release
- Ajouter d'autres artefacts

### Permissions GitHub

Le workflow utilise `GITHUB_TOKEN` automatique avec les permissions :
- ✅ Lecture du code source
- ✅ Création de releases  
- ✅ Upload d'artefacts

Aucune configuration supplémentaire nécessaire ! 🎉