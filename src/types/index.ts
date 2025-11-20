/**
 * Main types for PHP Test Collections Explorer
 * 
 * This module exports all types and interfaces used
 * in the extension for PHP test management.
 */

// Collections and configuration
export { TestCollection } from './TestCollection';

// Tests and statuses
export { TestMethod, TestStatus } from './TestMethod';

// Test files with metrics
export { TestFile } from './TestFile';

// Cache and persistence
export { CachedCollection, JsonCacheData } from './Cache';

// Logging configuration
export { LogLevel, LogLevelValues } from './LogLevel';