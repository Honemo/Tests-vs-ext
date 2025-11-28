#!/bin/bash
# Release script for PHP Test Collections Explorer
# Usage: ./scripts/release.sh [version]
# If no version provided, extracts the latest version from CHANGELOG.md

set -e  # Exit on any error

# Configuration
EXTENSION_NAME="tests-vs-extension"

# Function to extract latest version from CHANGELOG.md
get_latest_version_from_changelog() {
    if [ ! -f "CHANGELOG.md" ]; then
        echo "❌ Error: CHANGELOG.md not found"
        exit 1
    fi
    
    # Extract the first version number from CHANGELOG.md
    # Looks for pattern like "## [X.Y.Z]" or "## [X.Y.Z] - Date"
    local version=$(grep -E "^## \[[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -n 1 | sed -E 's/^## \[([0-9]+\.[0-9]+\.[0-9]+)\].*/\1/')
    
    if [ -z "$version" ]; then
        echo "❌ Error: No version found in CHANGELOG.md"
        echo "   Expected format: ## [X.Y.Z] - Date"
        exit 1
    fi
    
    echo "$version"
}

# Determine version to use
if [ -n "$1" ]; then
    VERSION="$1"
    echo "📋 Using provided version: $VERSION"
else
    VERSION=$(get_latest_version_from_changelog)
    echo "📋 Version extracted from CHANGELOG.md: $VERSION"
fi

echo "🚀 Creating release version $VERSION for $EXTENSION_NAME..."

# Vérifier que nous sommes à la racine du projet
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root directory"
    echo "   Usage: ./scripts/release.sh [version]"
    exit 1
fi

# Vérifier que la version existe dans le CHANGELOG
if ! grep -q "## \[$VERSION\]" CHANGELOG.md; then
    echo "❌ Error: Version $VERSION not found in CHANGELOG.md"
    echo "   Please add the version to CHANGELOG.md first"
    echo "   Expected format: ## [$VERSION] - $(date +%Y-%m-%d)"
    exit 1
fi

# Vérifier que vsce est disponible
if ! command -v vsce &> /dev/null; then
    echo "📦 Installing vsce..."
    npm install -g @vscode/vsce
fi

# Vérifier la branche Git
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  Warning: Not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Vérifier que la version dans package.json correspond
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
    echo "📝 Updating version in package.json from $PACKAGE_VERSION to $VERSION..."
    npm version $VERSION --no-git-tag-version
else
    echo "✅ Version in package.json already matches: $VERSION"
fi

# Nettoyer et compiler
echo "🔨 Cleaning and compiling..."
rm -rf dist/
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

# Générer le package
echo "📦 Generating VSIX package..."
npx @vscode/vsce package

VSIX_FILE="$EXTENSION_NAME-$VERSION.vsix"

if [ -f "$VSIX_FILE" ]; then
    echo "✅ Package created: $VSIX_FILE"
    
    # Afficher les informations du package
    echo ""
    echo "📋 Package Information:"
    ls -lh "$VSIX_FILE"
    
    # Afficher les notes de version depuis CHANGELOG.md
    echo ""
    echo "📋 Release Notes for v$VERSION:"
    echo "─────────────────────────────────────"
    # Extract release notes between this version and the next version or end of file
    awk "/^## \[$VERSION\]/,/^## \[/ { if(/^## \[/ && !/^## \[$VERSION\]/) exit; print }" CHANGELOG.md | tail -n +2
    echo "─────────────────────────────────────"
    
    # Proposer d'installer pour test
    echo ""
    read -p "Install for testing? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        code --install-extension "$VSIX_FILE"
        echo "✅ Extension installed for testing"
    fi
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Test the extension functionality"
    echo "2. Commit changes: git add . && git commit -m 'Release v$VERSION'"
    echo "3. Create git tag: git tag v$VERSION"
    echo "4. Push changes: git push origin main && git push origin v$VERSION"
    echo "5. Create GitHub release with $VSIX_FILE"
    echo ""
    echo "📁 Files to include in GitHub release:"
    echo "   - $VSIX_FILE"
    echo "   - CHANGELOG.md"
    echo "   - README.md"
    echo ""
    echo "📝 GitHub release description:"
    echo "   Copy the release notes shown above"
    
else
    echo "❌ Package generation failed!"
    exit 1
fi