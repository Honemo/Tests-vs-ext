#!/bin/bash
# Build script for PHP Test Collections Explorer

set -e

echo "🔨 Building PHP Test Collections Explorer..."

# Nettoyer les anciens builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf *.vsix

# Installer les dépendances
echo "📦 Installing dependencies..."
npm ci

# Compiler TypeScript
echo "⚙️  Compiling TypeScript..."
npm run compile

# Vérifier la compilation
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
else
    echo "❌ Build failed!"
    exit 1
fi