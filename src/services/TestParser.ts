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
     * Supports detection by: (1) pattern match + test methods, or (2) inheritance from test base class
     * @param filePath File path
     * @param testBaseClasses Optional custom test base class names for detection
     * @returns True if the file appears to be a valid PHP test file
     */
    isValidPhpTestFile(filePath: string, testBaseClasses?: string[]): boolean {
        try {
            if (!filePath.endsWith('.php')) {
                return false;
            }

            const content = fs.readFileSync(filePath, 'utf8');

            // Check for class presence
            const hasClass = /class\s+\w+/.test(content);
            if (!hasClass) {
                return false;
            }

            // Check for test methods presence (existing logic)
            const hasTestMethods = /(?:function\s+test\w+|@test[\s\S]*?function)/.test(content);
            if (hasTestMethods) {
                this.logger.logDebug(`✅ File detected as test (method convention): ${filePath}`);
                return true;
            }

            // Check for inheritance from test base class (new logic)
            const parentClass = this.extractParentClassName(content);
            if (parentClass) {
                const allBases = this.getAllTestBaseClasses(testBaseClasses);
                if (this.isTestBaseClass(parentClass, allBases)) {
                    this.logger.logDebug(`✅ File detected as test (class inheritance from ${parentClass}): ${filePath}`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.logger.logWarning(`⚠️ Unable to validate file ${filePath}: ${error}`);
            return false;
        }
    }

    /**
     * Extract the parent class name from PHP content
     * Supports both short names (TestCase) and fully qualified names (\PHPUnit\Framework\TestCase)
     * @param content PHP file content
     * @returns Parent class name or null if not found
     */
    private extractParentClassName(content: string): string | null {
        // Match "extends <ClassName>" after class definition
        // Supports: extends TestCase, extends \PHPUnit\Framework\TestCase, extends App\Testing\BaseTest
        const parentMatch = content.match(/class\s+\w+\s+extends\s+(\\?[\w\\]+)/);
        return parentMatch ? parentMatch[1] : null;
    }

    /**
     * Get all test base classes: defaults + custom ones
     * @param customClasses Optional custom test base classes
     * @returns Array of all test base class names to check
     */
    private getAllTestBaseClasses(customClasses?: string[]): string[] {
        const defaultBases = this.getDefaultTestBaseClasses();
        if (customClasses && customClasses.length > 0) {
            return [...defaultBases, ...customClasses];
        }
        return defaultBases;
    }

    /**
     * Get default test base classes for common frameworks
     * @returns Array of default test base class names
     */
    private getDefaultTestBaseClasses(): string[] {
        return [
            'testcase',  // Generic / Laravel / Symfony short form (case-insensitive)
            'phunit\\framework\\testcase',  // PHPUnit namespace
            'framework\\testcase',  // Common short form
            'symfony\\bundle\\frameworkbundle\\test\\kerneltestcase',  // Symfony
            'tests\\testcase',  // Laravel convention
        ];
    }

    /**
     * Check if an extracted parent class name matches any of the test base classes
     * @param extractedParent The parent class name extracted from code
     * @param testBaseClasses Array of test base classes to match against
     * @returns True if the parent class is a recognized test base class
     */
    private isTestBaseClass(extractedParent: string, testBaseClasses: string[]): boolean {
        const normalizedExtracted = this.normalizeClassName(extractedParent);

        for (const baseClass of testBaseClasses) {
            const normalizedBase = this.normalizeClassName(baseClass);
            if (normalizedExtracted === normalizedBase) {
                return true;
            }
        }

        return false;
    }

    /**
     * Normalize class name for comparison
     * Removes leading backslash and converts to lowercase for case-insensitive matching
     * @param className Class name (possibly with namespace)
     * @returns Normalized class name (lowercase, no leading backslash)
     */
    private normalizeClassName(className: string): string {
        // Remove leading backslash (PHP namespace)
        let normalized = className.startsWith('\\') ?
            className.slice(1) :
            className;

        // Convert to lowercase for case-insensitive comparison
        return normalized.toLowerCase();
    }
}