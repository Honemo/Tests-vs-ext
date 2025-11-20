import * as vscode from 'vscode';
import { TestCollection } from './TestCollection';
import { TestMethod } from './TestMethod';
import { TestFile } from './TestFile';

/**
 * Interface for cached collection in-memory data
 */
export interface CachedCollection {
    /** Collection configuration */
    collection: TestCollection;
    
    /** List of found test files */
    files: vscode.Uri[];
    
    /** List of all found test methods */
    methods: TestMethod[];
    
    /** List of test files with their metrics */
    testFiles: TestFile[];
    
    /** Date of last scan for this collection */
    lastScan: Date;
}

/**
 * Interface for persistent cache JSON structure
 */
export interface JsonCacheData {
    /** Collections indexed by name */
    collections: {[key: string]: {
        /** Collection configuration */
        collection: TestCollection;
        
        /** File paths (string for JSON serialization) */
        files: string[];
        
        /** Test methods with serialized dates */
        methods: TestMethod[];
        
        /** Test files with serialized dates */
        testFiles: TestFile[];
        
        /** Last scan date (string for JSON serialization) */
        lastScan: string;
    }};
    
    /** Global cache last update date */
    lastUpdate: string;
}