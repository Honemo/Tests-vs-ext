import { TestCollection } from './TestCollection';

/**
 * Enumeration of possible statuses for a test
 */
export enum TestStatus {
    Unknown = 'unknown',
    Passed = 'passed',
    Failed = 'failed',
    Error = 'error',
    Skipped = 'skipped',
    Running = 'running'
}

/**
 * Interface defining an individual test method
 */
export interface TestMethod {
    /** Test method name */
    name: string;
    
    /** Name of the class containing this test */
    className: string;
    
    /** Absolute path to the file containing this test */
    filePath: string;
    
    /** Collection this test belongs to */
    collection: TestCollection;
    
    /** Current test status */
    status?: TestStatus;
    
    /** Date of last execution */
    lastRun?: Date;
    
    /** Short error message in case of failure */
    errorMessage?: string;
    
    /** Complete error details (stack trace, PHPUnit output) */
    failureDetails?: string;
}