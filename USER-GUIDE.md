# PHP Test Collections Explorer - User Guide

Complete usage guide for the **PHP Test Collections Explorer** VS Code extension.

![Version](https://img.shields.io/badge/version-0.1.1-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0+-green)
![PHP](https://img.shields.io/badge/PHP-PHPUnit-purple)
![Docker](https://img.shields.io/badge/Docker-Supported-blue)

## 📚 Table of Contents

1. [Installation](#-installation)
2. [Quick Setup](#-quick-setup)
3. [Configuration](#-configuration)
4. [Using the Extension](#-using-the-extension)
5. [Docker Support](#-docker-support)
6. [Error Handling](#-error-handling)
7. [Logging System](#-logging-system)
8. [Troubleshooting](#-troubleshooting)
9. [Advanced Usage](#-advanced-usage)

## 🚀 Installation

### Method 1: Manual Installation (Recommended)
```bash
# Download the VSIX file
# In VS Code: Ctrl+Shift+P → "Extensions: Install from VSIX..."
# Select: php-test-collections-explorer-0.1.1.vsix
```

### Method 2: Script Installation
```bash
# Make the install script executable
chmod +x install.sh

# Run the installation script
./install.sh
```

The script will:
- ✅ Detect VS Code installation
- ✅ Find the latest VSIX version automatically
- ✅ Install or update the extension
- ✅ Provide post-installation instructions

## ⚡ Quick Setup

### 1. Open a PHP Project
```bash
# Open your PHP project in VS Code as a workspace
code /path/to/your/php/project

# OR create a workspace file
File → Save Workspace As... → project.code-workspace
```

### 2. Configure Test Collections

⚠️ IMPORTANT: This extension ONLY works with workspace settings. User settings are ignored.

1. Open Command Palette: Ctrl+Shift+P
2. Type: Preferences: Open Workspace Settings
3. Search for: phpTestCollections
4. Configure your collections in the UI Or add your configuration in the JSON settings

```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit"
    },
    {
      "name": "Feature Tests",
      "path": "tests/Feature", 
      "command": "vendor/bin/phpunit tests/Feature"
    }
  ]
}
```

### 3. View Test Explorer
- Open the **Test** tab in VS Code sidebar
- Find **"PHP Test Collections"** view
- Your tests will be automatically discovered and displayed

## 🔧 Configuration

### Basic Collection Configuration

```json
{
  "phpTestCollections.collections": [
    {
      "name": "Collection Name",           // Display name
      "path": "relative/path/to/tests",    // Path from workspace root
      "command": "vendor/bin/phpunit ...", // PHPUnit command
      "pattern": "**/*Test.php",           // File pattern (optional)
      "useDocker": false,                  // Docker execution (optional)
      "dockerImage": "container-name"      // Docker image (if useDocker=true)
    }
  ]
}
```

### Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | ✅ | Display name in Test Explorer |
| `path` | string | ✅ | Relative path from workspace root |
| `command` | string | ✅ | PHPUnit command to execute |
| `pattern` | string | ❌ | File pattern (default: `**/*Test.php`) |
| `useDocker` | boolean | ❌ | Enable Docker execution (default: `false`) |
| `dockerImage` | string | ❌ | Docker container name (required if `useDocker=true`) |
| `testBaseClasses` | string[] | ❌ | Base class names for inheritance detection (e.g., `["TestCase", "CustomBaseTest"]`) |

### Project Examples

#### Laravel Project
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Feature Tests",
      "path": "tests/Feature",
      "command": "vendor/bin/phpunit --testsuite=Feature",
      "pattern": "**/*Test.php"
    },
    {
      "name": "Unit Tests",
      "path": "tests/Unit", 
      "command": "vendor/bin/phpunit --testsuite=Unit"
    }
  ]
}
```

#### Symfony Project
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "bin/phpunit tests/Unit"
    },
    {
      "name": "Integration Tests",
      "path": "tests/Integration",
      "command": "bin/phpunit tests/Integration --env=test"
    },
    {
      "name": "Controller Tests",
      "path": "tests/Controller",
      "command": "bin/phpunit tests/Controller"
    }
  ]
}
```

#### Custom PHP Project
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Core Tests",
      "path": "tests/core",
      "command": "./vendor/bin/phpunit tests/core",
      "pattern": "*Test.php"
    },
    {
      "name": "API Tests", 
      "path": "tests/api",
      "command": "./vendor/bin/phpunit tests/api --coverage-clover=coverage.xml"
    }
  ]
}
```

### Test File Detection: Pattern vs. Inheritance

By default, the extension detects test files by **filename pattern** (e.g., `*Test.php`). For more flexible detection, you can enable **inheritance-based detection** using the `testBaseClasses` parameter.

#### When to Use Inheritance Detection

Use `testBaseClasses` when:
- ✅ Your test files don't follow strict naming conventions
- ✅ You have tests with flexible naming (e.g., `PaymentFlow.php`, `UserBehavior.php`)
- ✅ You want to detect tests solely by class inheritance
- ✅ You work with multiple frameworks in one project

#### Configuration Example
```json
{
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit",
      "pattern": "*Test.php",
      "testBaseClasses": ["TestCase", "CustomBaseTest"]
    }
  ]
}
```

#### How It Works

1. **First**: Files matching the `pattern` are discovered (optimized)
2. **Then**: Files NOT matching the pattern are scanned for inheritance
3. **Finally**: Both results are merged (duplicates removed)
4. **Auto-detect**: If `testBaseClasses` is not specified, common frameworks are auto-detected:
   - PHPUnit: `PHPUnit\Framework\TestCase`
   - Laravel: `Tests\TestCase`
   - Symfony: `Symfony\Bundle\FrameworkBundle\Test\KernelTestCase`

#### Concrete Examples

```php
// File: tests/Unit/UserTest.php
class UserTest extends TestCase { }
// ✅ Detected by pattern (*Test.php)

// File: tests/Feature/UserBehavior.php
class UserBehavior extends TestCase { }
// ✅ Detected by inheritance (even without "Test" in filename!)

// File: tests/Custom/PaymentProcessing.php
class PaymentProcessing extends CustomBaseTest { }
// ✅ Detected by inheritance when testBaseClasses includes "CustomBaseTest"

// File: tests/src/HelperTest.php
class HelperTest { }
// ❌ NOT detected (no pattern match AND no inheritance)
```

#### Mixed Configuration Example

```json
{
  "phpTestCollections.collections": [
    {
      "name": "PHPUnit Tests",
      "path": "tests",
      "command": "vendor/bin/phpunit tests",
      "pattern": "*Test.php",
      "testBaseClasses": ["TestCase"]  // Detect both patterns AND inheritance
    },
    {
      "name": "Custom Framework",
      "path": "tests-custom",
      "command": "vendor/bin/phpunit tests-custom",
      "pattern": "*.php",  // Very broad pattern
      "testBaseClasses": ["CustomTestBase", "App\\Testing\\TestCase"]  // Rely more on inheritance
    }
  ]
}
```

## 🎮 Using the Extension

### Test Explorer Interface

```
📁 PHP Test Collections
├── 🐳 Docker Integration Tests (5 files)
│   ├── ✅ AuthTest.php (3 tests)
│   │   ├── ✅ testSuccessfulLogin
│   │   ├── ❌ testFailedLogin
│   │   └── ⚪ testLogout
│   └── ✅ DatabaseTest.php (2 tests)
└── 📚 Unit Tests (8 files)
    ├── ✅ UserTest.php (4 tests)
    ├── ❌ PaymentTest.php (2 tests)
    └── ...
```

### Running Tests

#### 1. Individual Test
- **Right-click** on a test method
- **Select**: "Run Test"
- **Command**: `vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php`

#### 2. Complete File
- **Right-click** on a test file  
- **Select**: "Run Test File"
- **Command**: `vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php`

#### 3. Entire Collection
- **Right-click** on collection
- **Select**: "Run Test Collection" 
- **Command**: `vendor/bin/phpunit tests/Unit`

### Test Status Icons

| Icon | Status | Description |
|------|--------|-------------|
| ✅ | **Passed** | Test executed successfully |
| ❌ | **Failed** | Assertion failed |
| 💥 | **Error** | PHP error or exception |
| 🔄 | **Running** | Test currently executing |
| ⚪ | **Unknown** | Not tested yet |
| ⏭️ | **Skipped** | Test marked as skipped |

### Context Menu Actions

| Action | Available On | Function |
|--------|--------------|----------|
| **Run Test** | Individual test | Execute single test method |
| **Run Test File** | Test file | Execute all tests in file |
| **Run Test Collection** | Collection | Execute entire test suite |
| **Show Error Details** | Failed test | Display error information |
| **Open Test File** | Test file | Open file in editor |
| **Refresh Tests** | Any level | Reload test discovery |

## 🐳 Docker Support

### Enable Docker for a Collection
```json
{
  "name": "Docker Tests",
  "path": "tests/integration",
  "command": "vendor/bin/phpunit tests/integration",
  "useDocker": true,
  "dockerImage": "my-app-container"
}
```

### Command Transformation

#### Local Execution
```bash
vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php
```

#### Docker Execution  
```bash
docker exec my-app-container vendor/bin/phpunit --filter "UserTest::testLogin" tests/Unit/UserTest.php
```

### Docker Container Requirements

The extension expects:
- ✅ **Running container** with the specified name
- ✅ **PHPUnit available** inside container
- ✅ **Project mounted** in container
- ✅ **Working directory** properly set

### Docker Compose Example
```yaml
# docker-compose.yml
services:
  app:
    container_name: my-app-container
    build: .
    volumes:
      - .:/var/www/html
    working_dir: /var/www/html
```

### Troubleshooting Docker

**Container not found:**
```bash
# Verify container is running
docker ps | grep my-app-container

# Start if needed
docker-compose up -d app
```

**PHPUnit not found in container:**
```bash
# Test command inside container
docker exec my-app-container vendor/bin/phpunit --version
```

## 🛠️ Error Handling

### Error Details Panel

When a test fails, you can view detailed error information:

1. **Right-click** on failed test (❌)
2. **Select**: "Show Error Details" 
3. **New tab opens** with formatted error information

### Error Panel Content

```
╔══════════════════════════════════════════════════════════════════╗
║                         TEST ERROR DETAILS                       ║
╚══════════════════════════════════════════════════════════════════╝

🧪 Test Method: testFailedLogin
📁 Class: AuthTest  
📄 File: /project/tests/Unit/AuthTest.php
📚 Collection: Unit Tests
⏰ Last Run: 2024-11-28 14:30:15
🔴 Status: failed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Error Message:
Failed asserting that false is true.

📊 Full Error Output:
─────────────────────────────────────────────────────────────────
PHPUnit 9.5.10 by Sebastian Bergmann and contributors.

F                                                                   1 / 1 (100%)

Time: 00:00.003, Memory: 6.00 MB

There was 1 failure:

1) AuthTest::testFailedLogin
Failed asserting that false is true.

/project/tests/Unit/AuthTest.php:25

FAILURES!
Tests: 1, Assertions: 1, Failures: 1.
─────────────────────────────────────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Actions: You can re-run this test from the Test Explorer view
🔧 Debug: Set breakpoints in AuthTest::testFailedLogin()
```

### Common Error Types

#### Assertion Failures
```php
// Example failing test
public function testFailedLogin()
{
    $result = auth()->attempt(['invalid' => 'credentials']);
    $this->assertTrue($result); // ❌ Fails: result is false
}
```

#### PHP Errors
```php
// Example error
public function testDivisionByZero()
{
    $result = 10 / 0; // ❌ Error: Division by zero
    $this->assertEquals(0, $result);
}
```

#### Missing Dependencies
```bash
# Error: Class not found
Fatal error: Class 'SomeClass' not found in /project/tests/Unit/SomeTest.php:15
```

## 📊 Logging System

### Output Panel

All extension activity is logged in the **"PHP Test Collections"** output panel:
- **Access**: View → Output → "PHP Test Collections"
- **Real-time updates** during test execution
- **Configurable verbosity** levels
- **Searchable content** with timestamps

### Logging Levels

Configure in settings:
```json
{
  "phpTestCollections.logLevel": "info"
}
```

| Level | Icon | Description | Use Case |
|-------|------|-------------|----------|
| `"error"` | ❌ | Critical failures only | Production environments |
| `"warn"` | ⚠️ | Errors + warnings | CI/CD pipelines |
| `"info"` | ℹ️ | Standard operation (default) | Daily development |
| `"debug"` | 🔍 | Verbose diagnostic | Extension debugging |

### Log Examples

#### Info Level (default)
```
[14:30:15] ℹ️ PHP Test Collections extension initialized
[14:30:16] ℹ️ Loading 2 configured collections
[14:30:16] 📂 Collection: Unit Tests (path: tests/Unit)
[14:30:17] 🔄 Running test: AuthTest::testLogin
[14:30:18] ✅ Test passed: AuthTest::testLogin
```

#### Debug Level
```
[14:30:15] ℹ️ PHP Test Collections extension initialized
[14:30:15] 🔍 LoggingService initialized with level: debug
[14:30:16] 🔍 Cache initialized for workspace: /project
[14:30:16] 🔍 FileWatcher: Monitoring PHP files in tests/
[14:30:16] ℹ️ Loading 2 configured collections
[14:30:16] 🔍 Parsing PHP file: /project/tests/Unit/AuthTest.php
[14:30:16] 🔍 Found 3 test methods in AuthTest
```

### Command Logging

All executed commands are logged with full details:

```
[14:30:17] 🚀 Running test: AuthTest::testLogin
   Command: vendor/bin/phpunit --filter "AuthTest::testLogin" tests/Unit/AuthTest.php
   Collection: Unit Tests

[14:30:18] 🐳 Docker transformation for collection "Integration Tests"
   Original: vendor/bin/phpunit tests/Integration
   Docker: docker exec my-app vendor/bin/phpunit tests/Integration
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Tests Not Appearing

**Problem**: Test Explorer is empty

**Solutions**:
- ✅ Verify configuration in `.vscode/settings.json`
- ✅ Check that test files exist in specified paths
- ✅ Ensure file patterns match (default: `**/*Test.php`)
- ✅ Use "Refresh Tests" command

**Debug**:
```json
{
  "phpTestCollections.logLevel": "debug"
}
```

#### 2. PHPUnit Not Found

**Problem**: `vendor/bin/phpunit: command not found`

**Solutions**:
- ✅ Install PHPUnit: `composer require --dev phpunit/phpunit`
- ✅ Verify path: `ls -la vendor/bin/phpunit`
- ✅ Use absolute path in command

#### 3. Docker Container Issues

**Problem**: `Error response from daemon: No such container`

**Solutions**:
- ✅ Start container: `docker-compose up -d`
- ✅ Verify name: `docker ps --format "table {{.Names}}"`
- ✅ Check container status

#### 4. Permission Errors

**Problem**: `Permission denied: vendor/bin/phpunit`

**Solutions**:
- ✅ Fix permissions: `chmod +x vendor/bin/phpunit`
- ✅ Check file ownership
- ✅ Verify Docker volume mounts

### Performance Issues

#### Slow Test Discovery

**Symptoms**: Long delays when opening Test Explorer

**Solutions**:
- ✅ Limit test patterns: Use specific patterns like `*Test.php` instead of `**/*Test.php`
- ✅ Exclude vendor directory: Ensure tests are not in `vendor/`
- ✅ Clear cache: Use "Force Refresh" command

#### Memory Issues

**Symptoms**: VS Code becomes unresponsive

**Solutions**:
- ✅ Reduce logging level to `"error"`
- ✅ Limit number of test collections
- ✅ Close unused VS Code windows

### Debug Commands

#### Check Extension Status
```bash
# In VS Code integrated terminal
code --list-extensions | grep tests-vs-extension
```

#### Verify PHPUnit Installation
```bash
# Test PHPUnit locally
./vendor/bin/phpunit --version

# Test PHPUnit in Docker
docker exec your-container vendor/bin/phpunit --version
```

#### Validate Configuration
```bash
# Check settings file
cat .vscode/settings.json | jq .phpTestCollections
```

## 🚀 Advanced Usage

### Multiple Project Configuration

For workspaces with multiple PHP projects:

```json
{
  "phpTestCollections.collections": [
    {
      "name": "API Tests",
      "path": "packages/api/tests",
      "command": "cd packages/api && vendor/bin/phpunit"
    },
    {
      "name": "Frontend Tests", 
      "path": "packages/frontend/tests",
      "command": "cd packages/frontend && vendor/bin/phpunit"
    }
  ]
}
```

### Custom Test Patterns

```json
{
  "phpTestCollections.collections": [
    {
      "name": "Integration Tests",
      "path": "tests/integration", 
      "command": "vendor/bin/phpunit tests/integration",
      "pattern": "**/*IntegrationTest.php"
    },
    {
      "name": "E2E Tests",
      "path": "tests/e2e",
      "command": "vendor/bin/phpunit tests/e2e",
      "pattern": "**/E2E*Test.php"
    }
  ]
}
```

### Environment-Specific Configuration

#### Development
```json
{
  "phpTestCollections.logLevel": "debug",
  "phpTestCollections.collections": [
    {
      "name": "Unit Tests",
      "path": "tests/Unit",
      "command": "vendor/bin/phpunit tests/Unit --verbose"
    }
  ]
}
```

#### Production/CI
```json
{
  "phpTestCollections.logLevel": "error", 
  "phpTestCollections.collections": [
    {
      "name": "CI Tests",
      "path": "tests",
      "command": "vendor/bin/phpunit --coverage-clover=coverage.xml"
    }
  ]
}
```

### Keyboard Shortcuts

You can add custom keyboard shortcuts for common actions:

```json
// keybindings.json
[
  {
    "key": "ctrl+shift+t",
    "command": "tests-vs-extension.refreshTests"
  },
  {
    "key": "ctrl+alt+t", 
    "command": "tests-vs-extension.configureTestFolders"
  }
]
```

### Integration with Tasks

Combine with VS Code tasks for complex workflows:

```json
// tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run All Tests",
      "type": "shell",
      "command": "vendor/bin/phpunit",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always"
      }
    }
  ]
}
```

## 📞 Support

### Getting Help

1. **Check logs**: Output → "PHP Test Collections" 
2. **Increase verbosity**: Set `logLevel` to `"debug"`
3. **Review configuration**: Verify `.vscode/settings.json`
4. **Test manually**: Run PHPUnit commands in terminal

### Reporting Issues

When reporting issues, please include:

- ✅ **Extension version**: Check in Extensions view
- ✅ **VS Code version**: Help → About
- ✅ **PHP/PHPUnit version**: `php --version && vendor/bin/phpunit --version`
- ✅ **Configuration**: Your `.vscode/settings.json` (sanitized)
- ✅ **Logs**: Output from "PHP Test Collections" panel
- ✅ **Error screenshots**: If applicable

### Community Resources

- 📋 **Documentation**: This guide and README.md
- 🐛 **Issue Tracker**: [GitHub Issues](../../issues)
- 💡 **Feature Requests**: [GitHub Discussions](../../discussions)

---

🎯 **Master your PHP testing workflow with comprehensive visual control!**

*This guide covers all aspects of the PHP Test Collections Explorer extension. For quick reference, see the [README.md](./README.md) file.*