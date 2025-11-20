import { TestCollection } from './TestCollection';
import { TestStatus } from './TestMethod';

/**
 * Interface defining a test file with its global metrics
 */
export interface TestFile {
    /** Absolute path to the test file */
    filePath: string;
    
    /** Name of the main test class in this file */
    className: string;
    
    /** Collection this file belongs to */
    collection: TestCollection;
    
    /** Global file status (based on tests it contains) */
    status?: TestStatus;
    
    /** Date of last test execution in this file */
    lastRun?: Date;
    
    /** Total number of tests in this file */
    totalTests: number;
    
    /** Number of tests that passed */
    passedTests: number;
    
    /** Number of tests that failed */
    failedTests: number;
    
    /** Number of tests with PHP errors */
    errorTests: number;
    
    /** Number of skipped tests */
    skippedTests: number;
    
    /** Number of tests currently running */
    runningTests: number;
}