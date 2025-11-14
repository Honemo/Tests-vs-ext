/**
 * Interface définissant une collection de tests PHP
 * Peut être configurée pour s'exécuter en local ou dans un conteneur Docker
 */
export interface TestCollection {
    /** Nom affiché de la collection */
    name: string;
    
    /** Chemin vers le dossier contenant les tests */
    path: string;
    
    /** Commande PHPUnit à exécuter pour cette collection */
    command: string;
    
    /** Pattern de fichiers à scanner (par défaut **\/*Test.php) */
    pattern?: string;
    
    /** Si true, les tests s'exécutent dans un conteneur Docker */
    useDocker?: boolean;
    
    /** Nom de l'image/conteneur Docker à utiliser */
    dockerImage?: string;
}