#!/bin/bash
# Automated release script that creates tag and triggers CI/CD
# Usage: ./scripts/auto-release.sh [version]
# If no version provided, extracts version from CHANGELOG.md and creates tag automatically

set -e  # Exit on any error

# Configuration
EXTENSION_NAME="tests-vs-extension"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to extract latest version from CHANGELOG.md
get_latest_version_from_changelog() {
    if [ ! -f "CHANGELOG.md" ]; then
        echo "❌ Error: CHANGELOG.md not found"
        exit 1
    fi
    
    local version=$(grep -E "^## \[[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -n 1 | sed -E 's/^## \[([0-9]+\.[0-9]+\.[0-9]+)\].*/\1/')
    
    if [ -z "$version" ]; then
        echo "❌ Error: No version found in CHANGELOG.md"
        echo "   Expected format: ## [X.Y.Z] - Date"
        exit 1
    fi
    
    echo "$version"
}

# Determine version
if [ -n "$1" ]; then
    VERSION="$1"
    echo "📋 Using provided version: $VERSION"
else
    VERSION=$(get_latest_version_from_changelog)
    echo "📋 Version extracted from CHANGELOG.md: $VERSION"
fi

echo "🚀 Starting automated release process for version $VERSION..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root directory"
    exit 1
fi

# Check if version exists in CHANGELOG
if ! grep -q "## \[$VERSION\]" CHANGELOG.md; then
    echo "❌ Error: Version $VERSION not found in CHANGELOG.md"
    echo "   Please add the version to CHANGELOG.md first"
    echo "   Expected format: ## [$VERSION] - $(date +%Y-%m-%d)"
    exit 1
fi

# Check git status
echo "🔍 Checking git status..."

if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Working directory is not clean"
    echo "   Please commit or stash your changes first"
    git status --porcelain
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  Warning: Not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "❌ Error: Tag v$VERSION already exists"
    echo "   Use 'git tag -d v$VERSION' to delete it first if needed"
    exit 1
fi

# Update package.json version if needed
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
    echo "📝 Updating version in package.json from $PACKAGE_VERSION to $VERSION..."
    npm version $VERSION --no-git-tag-version
    
    echo "💾 Committing version update..."
    git add package.json package-lock.json
    git commit -m "chore: bump version to $VERSION"
else
    echo "✅ Version in package.json already matches: $VERSION"
fi

# Pull latest changes to make sure we're up to date
echo "📥 Pulling latest changes from remote..."
git pull origin "$CURRENT_BRANCH"

# Build and test locally first
echo "🔨 Building extension locally..."
npm run package

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Show release notes
echo ""
echo "📋 Release Notes for v$VERSION:"
echo "─────────────────────────────────────"
awk "/^## \[$VERSION\]/,/^## \[/ { if(/^## \[/ && !/^## \[$VERSION\]/) exit; print }" CHANGELOG.md | tail -n +2
echo "─────────────────────────────────────"

# Final confirmation
echo ""
echo "🚨 This will:"
echo "   1. Create git tag 'v$VERSION'"
echo "   2. Push tag to origin"
echo "   3. Trigger GitHub Actions CI/CD"
echo "   4. Automatically create GitHub release"
echo "   5. Build and attach .vsix file to release"
echo ""
read -p "Proceed with automated release? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
fi

# Create and push tag
echo "🏷️  Creating git tag v$VERSION..."
git tag -a "v$VERSION" -m "Release version $VERSION

$(awk "/^## \[$VERSION\]/,/^## \[/ { if(/^## \[/ && !/^## \[$VERSION\]/) exit; print }" CHANGELOG.md | tail -n +2)"

echo "📤 Pushing tag to remote..."
git push origin "v$VERSION"

echo ""
echo "✅ Release process initiated successfully!"
echo ""
echo "🔄 GitHub Actions will now:"
echo "   1. Build the extension"
echo "   2. Create a GitHub release"
echo "   3. Attach the .vsix file"
echo ""
echo "🌐 Monitor the process at:"
echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[/:]\([^/]*\/[^/]*\)\.git/\1/')/actions"
echo ""
echo "🎯 Your release will be available at:"
echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[/:]\([^/]*\/[^/]*\)\.git/\1/')/releases/tag/v$VERSION"