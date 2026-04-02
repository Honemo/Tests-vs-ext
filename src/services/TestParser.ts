import * as fs from 'fs';
import { TestMethod, TestStatus } from '../types/TestMethod';
import { TestCollection } from '../types/TestCollection';
import { LoggingService } from './LoggingService';

/**
 * PHP file parsing service to extract test methods
 * 
 * Responsibilities:
 * - Parse PHP test files
 * - Extract test methods (test* convention and @test annotation)
 * - Identify class names
 * - Handle parsing errors
 */
export class TestParser {
    constructor(private logger: LoggingService) {}

    /**
     * Parse a PHP test file to extract all test methods
     * @param filePath Absolute path to the PHP file
     * @param collection Associated test collection
     * @returns List of found test methods
     */
    async parsePhpTestFile(filePath: string, collection: TestCollection): Promise<TestMethod[]> {
        try {
            this.logger.logDebug(`🔍 Parsing PHP file: ${filePath}`);
            
            const content = fs.readFileSync(filePath, 'utf8');
            const methods: TestMethod[] = [];
            
            // Extract class name
            const className = this.extractClassName(content);
            if (!className) {
                this.logger.logWarning(`⚠️ No class found in ${filePath}`);
                return methods;
            }

            this.logger.logDebug(`📝 Class detected: ${className}`);
            
            // Extract test methods
            const testMethods = this.extractTestMethods(content, className, filePath, collection);
            methods.push(...testMethods);
            
            this.logger.logDebug(`✅ Parsing completed: ${methods.length} methods found in ${className}`);;
            return methods;
            
        } catch (error) {
            this.logger.logError(`❌ Error parsing file ${filePath}`, error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    /**
     * Extract the main class name from the PHP file
     * @param content PHP file content
     * @returns Class name or null if not found
     */
    private extractClassName(content: string): string | null {
        const classMatch = content.match(/(?:^|\n)\s*(?:abstract\s+|final\s+)?class\s+(\w+)/);
        return classMatch ? classMatch[1] : null;
    }

    /**
     * Extract all test methods from PHP content
     * @param content PHP file content
     * @param className Class name
     * @param filePath File path
     * @param collection Test collection
     * @returns List of test methods
     */
    private extractTestMethods(content: string, className: string, filePath: string, collection: TestCollection): TestMethod[] {
        const methods: TestMethod[] = [];

        // Methods starting with 'test'
        const conventionMethods = this.findConventionTestMethods(content);
        for (const methodInfo of conventionMethods) {
            methods.push(this.createTestMethod(methodInfo.name, className, filePath, collection, methodInfo.lineNumber));
        }

        // Methods with @test annotation
        const annotatedMethods = this.findAnnotatedTestMethods(content);
        for (const methodInfo of annotatedMethods) {
            // Avoid duplicates
            if (!methods.some(m => m.name === methodInfo.name)) {
                methods.push(this.createTestMethod(methodInfo.name, className, filePath, collection, methodInfo.lineNumber));
            }
        }

        return methods;
    }

    /**
     * Find methods following the test* convention
     * @param content PHP file content
     * @returns List of method info with names and line numbers
     */
    private findConventionTestMethods(content: string): Array<{name: string, lineNumber: number}> {
        const methods: Array<{name: string, lineNumber: number}> = [];
        const methodRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:public\s+)?function\s+(test\w+)\s*\([^)]*\)/g;
        
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            const lineNumber = this.getLineNumber(content, match.index);
            methods.push({ name: match[1], lineNumber });
        }

        return methods;
    }

    /**
     * Find methods with @test annotation
     * @param content PHP file content
     * @returns List of method info with names and line numbers
     */
    private findAnnotatedTestMethods(content: string): Array<{name: string, lineNumber: number}> {
        const methods: Array<{name: string, lineNumber: number}> = [];
        const annotationRegex = /@test[\s\S]*?public\s+function\s+(\w+)\s*\([^)]*\)/g;
        
        let match;
        while ((match = annotationRegex.exec(content)) !== null) {
            const lineNumber = this.getLineNumber(content, match.index);
            methods.push({ name: match[1], lineNumber });
        }

        return methods;
    }

    /**
     * Calculate line number from string index
     * @param content File content
     * @param index Character index
     * @returns Line number (1-based)
     */
    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * Create a TestMethod object
     * @param name Method name
     * @param className Class name
     * @param filePath File path
     * @param collection Test collection
     * @param lineNumber Line number where the method is defined
     * @returns TestMethod object
     */
    private createTestMethod(name: string, className: string, filePath: string, collection: TestCollection, lineNumber?: number): TestMethod {
        return {
            name,
            className,
            filePath,
            lineNumber,
            collection,
            status: TestStatus.Unknown
        };
    }

    /**
     * Parse multiple PHP files in parallel
     * @param filePaths List of file paths
     * @param collection Test collection
     * @returns Combined list of all methods
     */
    async parseMultipleFiles(filePaths: string[], collection: TestCollection): Promise<TestMethod[]> {
        const allMethods: TestMethod[] = [];
        
        this.logger.logDebug(`🔍 Parsing ${filePaths.length} PHP files...`);
        
        const promises = filePaths.map(filePath => this.parsePhpTestFile(filePath, collection));
        const results = await Promise.all(promises);
        
        for (const methods of results) {
            allMethods.push(...methods);
        }
        
        this.logger.logDebug(`✅ Parsing completed: ${allMethods.length} methods found in total`);
        return allMethods;
    }

    /**
     * Validate PHP test file format
     * @param filePath File path
     * @returns True if the file appears to be a valid PHP test file
     */
    isValidPhpTestFile(filePath: string): boolean {
        try {
            if (!filePath.endsWith('.php')) {
                return false;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for class presence
            const hasClass = /class\s+\w+/.test(content);
            
            // Check for test methods presence
            const hasTestMethods = /(?:function\s+test\w+|@test[\s\S]*?function)/.test(content);
            
            return hasClass && hasTestMethods;
        } catch (error) {
            this.logger.logWarning(`⚠️ Unable to validate file ${filePath}: ${error}`);
            return false;
        }
    }
}