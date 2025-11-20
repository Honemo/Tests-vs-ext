/**
 * Interface defining a PHP test collection
 * Can be configured to run locally or in a Docker container
 */
export interface TestCollection {
    /** Display name of the collection */
    name: string;
    
    /** Path to the folder containing tests */
    path: string;
    
    /** PHPUnit command to execute for this collection */
    command: string;
    
    /** File pattern to scan (default *Test.php) */
    pattern?: string;
    
    /** If true, tests run in a Docker container */
    useDocker?: boolean;
    
    /** Name of Docker image/container to use */
    dockerImage?: string;
}