import { TestCollection } from './TestCollection';
import { TestStatus } from './TestMethod';

/**
 * Interface définissant un fichier de test avec ses métriques globales
 */
export interface TestFile {
    /** Chemin absolu vers le fichier de test */
    filePath: string;
    
    /** Nom de la classe principale de test dans ce fichier */
    className: string;
    
    /** Collection à laquelle appartient ce fichier */
    collection: TestCollection;
    
    /** Statut global du fichier (basé sur les tests qu'il contient) */
    status?: TestStatus;
    
    /** Date de la dernière exécution de tests dans ce fichier */
    lastRun?: Date;
    
    /** Nombre total de tests dans ce fichier */
    totalTests: number;
    
    /** Nombre de tests qui ont réussi */
    passedTests: number;
    
    /** Nombre de tests qui ont échoué */
    failedTests: number;
    
    /** Nombre de tests avec des erreurs PHP */
    errorTests: number;
    
    /** Nombre de tests ignorés */
    skippedTests: number;
    
    /** Nombre de tests en cours d'exécution */
    runningTests: number;
}