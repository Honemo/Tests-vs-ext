import * as fs from 'fs';
import { TestMethod, TestStatus } from '../types/TestMethod';
import { TestCollection } from '../types/TestCollection';
import { LoggingService } from './LoggingService';

/**
 * Service de parsing des fichiers PHP pour extraire les méthodes de test
 * 
 * Responsabilités:
 * - Parser les fichiers PHP de test
 * - Extraire les méthodes de test (convention test* et annotation @test)
 * - Identifier les noms de classes
 * - Gérer les erreurs de parsing
 */
export class TestParser {
    constructor(private logger: LoggingService) {}

    /**
     * Parse un fichier PHP de test pour extraire toutes les méthodes de test
     * @param filePath Chemin absolu vers le fichier PHP
     * @param collection Collection de test associée
     * @returns Liste des méthodes de test trouvées
     */
    async parsePhpTestFile(filePath: string, collection: TestCollection): Promise<TestMethod[]> {
        try {
            this.logger.logInfo(`🔍 Parsing fichier PHP: ${filePath}`);
            
            const content = fs.readFileSync(filePath, 'utf8');
            const methods: TestMethod[] = [];
            
            // Extraire le nom de la classe
            const className = this.extractClassName(content);
            if (!className) {
                this.logger.logWarning(`⚠️ Aucune classe trouvée dans ${filePath}`);
                return methods;
            }

            this.logger.logDebug(`📝 Classe détectée: ${className}`);
            
            // Extraire les méthodes de test
            const testMethods = this.extractTestMethods(content, className, filePath, collection);
            methods.push(...testMethods);
            
            this.logger.logInfo(`✅ Parsing terminé: ${methods.length} méthodes trouvées dans ${className}`);
            return methods;
            
        } catch (error) {
            this.logger.logError(`❌ Erreur lors du parsing du fichier ${filePath}`, error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }

    /**
     * Extrait le nom de la classe principale du fichier PHP
     * @param content Contenu du fichier PHP
     * @returns Nom de la classe ou null si non trouvé
     */
    private extractClassName(content: string): string | null {
        const classMatch = content.match(/class\s+(\w+)/);
        return classMatch ? classMatch[1] : null;
    }

    /**
     * Extrait toutes les méthodes de test du contenu PHP
     * @param content Contenu du fichier PHP
     * @param className Nom de la classe
     * @param filePath Chemin du fichier
     * @param collection Collection de test
     * @returns Liste des méthodes de test
     */
    private extractTestMethods(content: string, className: string, filePath: string, collection: TestCollection): TestMethod[] {
        const methods: TestMethod[] = [];

        // Méthodes qui commencent par 'test'
        const conventionMethods = this.findConventionTestMethods(content);
        for (const methodName of conventionMethods) {
            methods.push(this.createTestMethod(methodName, className, filePath, collection));
        }

        // Méthodes avec annotation @test
        const annotatedMethods = this.findAnnotatedTestMethods(content);
        for (const methodName of annotatedMethods) {
            // Éviter les doublons
            if (!methods.some(m => m.name === methodName)) {
                methods.push(this.createTestMethod(methodName, className, filePath, collection));
            }
        }

        return methods;
    }

    /**
     * Trouve les méthodes suivant la convention test*
     * @param content Contenu du fichier PHP
     * @returns Liste des noms de méthodes
     */
    private findConventionTestMethods(content: string): string[] {
        const methods: string[] = [];
        const methodRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:public\s+)?function\s+(test\w+)\s*\([^)]*\)/g;
        
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            methods.push(match[1]);
        }

        return methods;
    }

    /**
     * Trouve les méthodes avec annotation @test
     * @param content Contenu du fichier PHP
     * @returns Liste des noms de méthodes
     */
    private findAnnotatedTestMethods(content: string): string[] {
        const methods: string[] = [];
        const annotationRegex = /@test[\s\S]*?public\s+function\s+(\w+)\s*\([^)]*\)/g;
        
        let match;
        while ((match = annotationRegex.exec(content)) !== null) {
            methods.push(match[1]);
        }

        return methods;
    }

    /**
     * Crée un objet TestMethod
     * @param name Nom de la méthode
     * @param className Nom de la classe
     * @param filePath Chemin du fichier
     * @param collection Collection de test
     * @returns Objet TestMethod
     */
    private createTestMethod(name: string, className: string, filePath: string, collection: TestCollection): TestMethod {
        return {
            name,
            className,
            filePath,
            collection,
            status: TestStatus.Unknown
        };
    }

    /**
     * Parse plusieurs fichiers PHP en parallèle
     * @param filePaths Liste des chemins de fichiers
     * @param collection Collection de test
     * @returns Liste combinée de toutes les méthodes
     */
    async parseMultipleFiles(filePaths: string[], collection: TestCollection): Promise<TestMethod[]> {
        const allMethods: TestMethod[] = [];
        
        this.logger.logInfo(`🔍 Parsing de ${filePaths.length} fichiers PHP...`);
        
        const promises = filePaths.map(filePath => this.parsePhpTestFile(filePath, collection));
        const results = await Promise.all(promises);
        
        for (const methods of results) {
            allMethods.push(...methods);
        }
        
        this.logger.logInfo(`✅ Parsing terminé: ${allMethods.length} méthodes trouvées au total`);
        return allMethods;
    }

    /**
     * Validation du format de fichier PHP de test
     * @param filePath Chemin du fichier
     * @returns True si le fichier semble être un fichier de test PHP valide
     */
    isValidPhpTestFile(filePath: string): boolean {
        try {
            if (!filePath.endsWith('.php')) {
                return false;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            
            // Vérifier présence d'une classe
            const hasClass = /class\s+\w+/.test(content);
            
            // Vérifier présence de méthodes de test
            const hasTestMethods = /(?:function\s+test\w+|@test[\s\S]*?function)/.test(content);
            
            return hasClass && hasTestMethods;
        } catch (error) {
            this.logger.logWarning(`⚠️ Impossible de valider le fichier ${filePath}: ${error}`);
            return false;
        }
    }
}