#!/bin/bash
# Script d'installation automatique de l'extension PHP Test Collections Explorer

echo "🚀 Installation de l'extension PHP Test Collections Explorer..."

# Vérifier que VS Code est installé
if ! command -v code &> /dev/null; then
    echo "❌ VS Code n'est pas installé ou la commande 'code' n'est pas disponible"
    echo "   Veuillez installer VS Code et vous assurer que la commande 'code' fonctionne"
    exit 1
fi

# Vérifier que le fichier VSIX existe
VSIX_FILE="tests-vs-extension-0.0.1.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Fichier $VSIX_FILE introuvable"
    echo "   Veuillez vous assurer d'être dans le bon dossier"
    exit 1
fi

# Installer l'extension
echo "📦 Installation de l'extension..."
if code --install-extension "$VSIX_FILE"; then
    echo "✅ Extension installée avec succès !"
    echo ""
    echo "🎯 Prochaines étapes :"
    echo "1. Ouvrir VS Code dans un projet PHP avec des tests"
    echo "2. La vue 'PHP Test Collections' apparaîtra automatiquement"
    echo "3. Configurer vos collections de tests si nécessaire"
    echo ""
    echo "📚 Pour plus d'aide, consultez GUIDE-UTILISATION.md"
else
    echo "❌ Erreur lors de l'installation"
    echo "   Essayez l'installation manuelle :"
    echo "   1. Ouvrir VS Code"
    echo "   2. Ctrl+Shift+P"
    echo "   3. 'Extensions: Install from VSIX...'"
    echo "   4. Sélectionner $VSIX_FILE"
    exit 1
fi