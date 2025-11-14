import { TestCollection } from './TestCollection';

/**
 * Énumération des statuts possibles pour un test
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
 * Interface définissant une méthode de test individuelle
 */
export interface TestMethod {
    /** Nom de la méthode de test */
    name: string;
    
    /** Nom de la classe contenant ce test */
    className: string;
    
    /** Chemin absolu vers le fichier contenant ce test */
    filePath: string;
    
    /** Collection à laquelle appartient ce test */
    collection: TestCollection;
    
    /** Statut actuel du test */
    status?: TestStatus;
    
    /** Date de la dernière exécution */
    lastRun?: Date;
    
    /** Message d'erreur court en cas d'échec */
    errorMessage?: string;
    
    /** Détails complets de l'erreur (stack trace, output PHPUnit) */
    failureDetails?: string;
}