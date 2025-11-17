#!/bin/bash
# Automatic installation script for PHP Test Collections Explorer extension

echo "🚀 Installing PHP Test Collections Explorer extension..."

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code is not installed or 'code' command is not available"
    echo "   Please install VS Code and ensure the 'code' command works"
    exit 1
fi

# Automatically detect the most recent VSIX file
echo "🔍 Searching for VSIX file..."
VSIX_FILE=$(find . -maxdepth 1 -name "tests-vs-extension-*.vsix" -type f | sort -V | tail -n 1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ No VSIX file found"
    echo "   Please ensure a tests-vs-extension-*.vsix file exists in this directory"
    echo "   Generate it with: npm run package"
    exit 1
fi

# Extract version from filename
VERSION=$(basename "$VSIX_FILE" .vsix | sed 's/tests-vs-extension-//')
echo "📦 File detected: $VSIX_FILE (version $VERSION)"

# Check if extension is already installed
INSTALLED_VERSION=$(code --list-extensions --show-versions | grep "tests-vs-extension" | cut -d'@' -f2)
if [ ! -z "$INSTALLED_VERSION" ]; then
    echo "ℹ️  Extension already installed (version $INSTALLED_VERSION)"
    echo "🔄 Updating to version $VERSION..."
    # Uninstall old version
    code --uninstall-extension tests-vs-extension > /dev/null 2>&1
fi

# Install the extension
echo "📦 Installing extension version $VERSION..."
if code --install-extension "$VSIX_FILE"; then
    echo "✅ Extension installed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Open VS Code in a PHP project with tests"
    echo "2. The 'PHP Test Collections' view will appear in the Test tab"
    echo "3. Configure your test collections if needed"
    echo ""
    echo "📚 For more help, check README.md"
    echo "🔧 Available commands:"
    echo "   - Refresh Tests"
    echo "   - Add Test Collection"
    echo "   - Configure Test Collections"
else
    echo "❌ Installation error"
    echo "   Try manual installation:"
    echo "   1. Open VS Code"
    echo "   2. Ctrl+Shift+P"
    echo "   3. 'Extensions: Install from VSIX...'"
    echo "   4. Select $VSIX_FILE"
    exit 1
fi