# PHP Test Collections Explorer

A powerful VS Code extension for exploring, organizing, and executing PHP test collections with comprehensive Docker support.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0+-green)
![PHP](https://img.shields.io/badge/PHP-PHPUnit-purple)
![Docker](https://img.shields.io/badge/Docker-Supported-blue)

## ✨ Features

- 📁 **Collection Organization** - Group your tests by folders (Unit, Feature, Integration...)
- 🎯 **Granular Execution** - Run individual tests, entire files, or complete collections
- 🐳 **Native Docker Support** - Seamless execution in containers with automatic command transformation
- 📊 **Visual Status** - Icons for passed/failed/running tests with detailed error information
- 🔍 **Error Details** - Complete visualization of PHP failures and errors
- ⚡ **Smart Cache** - Optimized scanning with automatic updates
- 📋 **Complete Logging** - All commands tracked in dedicated Output tab
- �️ **Terminal Management** - Intelligent terminal reuse and cleanup

## 🚀 Quick Start

1. **Install**: Download `php-test-collections-explorer-0.1.0.vsix`
2. **VS Code**: `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. **Open** a PHP project with tests
4. **View**: "PHP Test Collections" appears automatically in the Test tab

## Install by script
 
```
#Run in your terminal
chmod +x install.sh
./install.sh
```

## 🎮 Usage

### Intuitive Tree View
```
🐳 Docker Integration Tests (5 files)
├── ✅ AuthTest.php (3 tests)
│   ├── ✅ testLogin
│   ├── ❌ testFailedLogin  
│   └── ⚪ testLogout
└── ✅ DatabaseTest.php (2 tests)

📚 Unit Tests (8 files)
├── ✅ UserTest.php (4 tests)
└── ...
```

### Simple Configuration
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
      "name": "Docker Integration",
      "path": "tests/Integration",
      "command": "vendor/bin/phpunit tests/Integration", 
      "useDocker": true,
      "dockerImage": "my-app"
    }
  ],
  "phpTestCollections.logLevel": "info"
}
```

### Execution Types

| Action | Result | Generated Command |
|--------|--------|-------------------|
| ▶️ Individual test | `testLogin` only | `--filter "UserTest::testLogin"` |
| ▶️ Complete file | All tests in file | `--filter "UserTest"` |  
| ▶️ Collection | Entire test suite | Full command |

## 🐳 Docker Support

Automatic command transformation:
- **Local**: `vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php`
- **Docker**: `docker exec my-app vendor/bin/phpunit --filter "UserTest" tests/Unit/UserTest.php`

## 📊 Test Status

| Icon | Status | Description |
|------|--------|-------------|
| ✅ | Passed | Test successful |
| ❌ | Failed | Assertion failed |
| 💥 | Error | PHP error |
| 🔄 | Running | Executing |
| ⚪ | Unknown | Not tested |

## 🔧 Advanced Configuration

### Laravel Project
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
  "dockerImage": "my-project_app"
}
```

### Symfony Project
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

## 📋 Logs and Debugging

### Output System
- **Output Tab**: "PHP Test Collections"  
- **Configurable Levels**: `error` | `warn` | `info` | `debug`
- **Real-time Filtering**: Only relevant messages displayed
- **Traced Commands** with timestamps
- **Detailed Docker errors**

### Logging Levels
- **🔴 Error**: Critical failures only
- **🟡 Warning**: + Configuration issues  
- **🔵 Info**: + Test execution (default)
- **🟣 Debug**: + Internal operations

### Logging Configuration

Control the verbosity of extension output with configurable logging levels:

```json
{
  "phpTestCollections.logLevel": "info"
}
```

| Level | Description | Output |
|-------|-------------|--------|
| `"error"` | Critical errors only | ❌ Fatal errors, crashes |
| `"warn"` | Errors + warnings | ❌ + ⚠️ Configuration issues, missing files |
| `"info"` | Standard output (default) | ❌ + ⚠️ + ℹ️ Test execution, cache operations |
| `"debug"` | Verbose development mode | ❌ + ⚠️ + ℹ️ + 🔍 Internal operations, parsing details |

**Examples:**
- **Production**: `"error"` - Only critical issues
- **Development**: `"debug"` - Full diagnostic information
- **CI/CD**: `"warn"` - Balanced output for automation
- **Default**: `"info"` - Perfect for daily usage

### Quick Actions
- **Force refresh**: 🔄 Button
- **Change log level**: VS Code Settings → "PHP Test Collections"
- **View logs**: Output → "PHP Test Collections"

## 🛠️ Development

```bash
# Clone the repo
git clone [your-repo]
cd Tests-vs-ext

# Install dependencies
npm install

# Compile
npm run compile

# Launch dev mode
F5 (Extension Development Host)

# Create package
vsce package

#Generate your own package
npx @vscode/vsce package
```

## 🎯 Use Cases

✅ **PHP Developers** working with PHPUnit  
✅ **Laravel/Symfony projects** with organized tests  
✅ **Docker environments** for integration  
✅ **E2E testing** with complex configurations  
✅ **Teams** needing consistency in test execution  

## 📞 Support

- 📋 **Logs**: Output → "PHP Test Collections"
- 🔍 **Debugging**: Check the usage guide
- 🐛 **Issues**: [Create an issue](../../issues)

## 🏗️ Architecture

### Modular Design (6 Services)
- 📁 **types/**: Centralized TypeScript interfaces
- 📝 **LoggingService**: Configurable logging system with 4 levels (113 lines)
- 💾 **CacheService**: JSON cache management (228 lines)
- 🚀 **TestRunner**: PHPUnit execution engine (492 lines)
- 🔍 **TestParser**: PHP parsing with dual detection (190 lines)
- 👁️ **FileWatcher**: Real-time file monitoring (202 lines)

### Performance Metrics
- **Code Reduction**: 68% (1877 → 595 lines in main file)
- **Bundle Size**: 85.3 KiB (optimized)
- **Cache System**: Workspace-specific JSON persistence
- **Compilation**: Zero TypeScript errors

## 📚 Documentation

- [Complete User Guide](./USER-GUIDE.md)
- [Docker Configuration](./USER-GUIDE.md#-docker-support)
- [Troubleshooting](./USER-GUIDE.md#-troubleshooting)

## 🔗 Requirements

- VS Code ^1.105.0
- PHP project with PHPUnit tests
- Optional: Docker for containerized execution

---

🚀 **Transform your PHP testing workflow with a powerful visual interface!**
