# Changelog

All notable changes to the "PHP Test Collections Explorer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.1.1] - 2024-11-28

### ✨ New Features
- **Test Error Details Panel**: New dedicated WebView panel for displaying test errors
  - Rich HTML formatting with VS Code theme integration
  - Detailed error information including method, class, file, and collection
  - Formatted error messages and stack traces
  - Suggested actions for debugging
- **Enhanced Error Visualization**: Improved error display with proper HTML escaping
- **Better UX**: Test error details now open in a separate tab instead of modal dialogs

### 🔧 Improvements  
- **Logging System**: Fully configurable logging levels (error, warn, info, debug)
  - Real-time level changes without restart
  - Performance optimization by filtering debug messages
  - Clear level hierarchy and user documentation
- **Code Translation**: Complete English translation of all source files
  - Professional documentation and comments
  - Consistent terminology across the extension
  - International-ready codebase

### 🐛 Bug Fixes
- **Error Display**: Fixed modal dialog limitations for long error messages
- **HTML Escaping**: Proper escaping of error content to prevent rendering issues
- **UI Consistency**: Improved error presentation consistency

### 📚 Documentation
- **README**: Added comprehensive logging configuration section
- **Error Handling**: Documented new error details panel functionality
- **Code Comments**: All source files now have English documentation

## [0.1.0] - 2025-11-17

### 🎉 Added
- ✨ **Modular architecture**: Code reorganized into 6 autonomous services
- ✨ **Complete Docker support**: Native execution in containers  
- ✨ **File status indicators**: Visual indicators for each test file
- ✨ **Dedicated Test tab**: View integrated in VS Code Test tab
- ✨ **Advanced logging**: Detailed output with timestamps
- ✨ **File execution**: Button to run all tests in a file
- ✨ **Individual test execution**: Run specific test methods
- ✨ **Test collections**: Organize tests by logical groups

### 🚀 Improved
- 🚀 **Performance**: Smart cache with automatic refresh
- 🎯 **UX**: Informative tooltips and status icons
- 🔍 **Debug**: Complete logs in "PHP Test Collections" Output
- ⚡ **Stability**: Robust error handling and fallbacks
- 🖥️ **Terminal management**: Reuse terminals per collection

### 🏗️ Technical Architecture
- 📁 **types/**: Centralized TypeScript interfaces
- 📝 **LoggingService**: Premium logging system
- 💾 **CacheService**: Workspace-specific JSON cache management
- 🚀 **TestRunner**: PHPUnit execution with Docker support
- 🔍 **TestParser**: PHP parsing with dual detection
- 👁️ **FileWatcher**: Real-time file monitoring

### 🐛 Fixed
- ✅ **Terminal TTY**: Removed `-it` flag for VS Code compatibility
- ✅ **Configuration**: Required workspace validation
- ✅ **File opening**: Fixed test file URI handling
- ✅ **Command order**: PHPUnit `--filter` syntax before file

### 🎯 Features
- **PHP/PHPUnit Support**: Automatic detection of `*Test.php` files
- **Test method detection**: Both `testXxx()` methods and `@test` annotations
- **Hierarchical view**: Collection → File → Test methods
- **Status tracking**: Visual indicators for test states (passed/failed/running/unknown)
- **Docker integration**: Seamless container execution with image configuration
- **Cache system**: Persistent test discovery for faster loading
- **Terminal management**: Smart terminal reuse and cleanup

## [0.0.1] - 2025-11-15

### 🎉 Initial Release
- 📚 Configurable test collections
- 🎯 Individual test and collection execution
- ⚙️ Graphical interface in VS Code explorer
- 🔧 Flexible JSON configuration