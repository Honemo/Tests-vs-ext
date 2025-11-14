import * as vscode from 'vscode';
import { TestCollection } from './TestCollection';
import { TestMethod } from './TestMethod';
import { TestFile } from './TestFile';

/**
 * Interface pour les données en mémoire d'une collection mise en cache
 */
export interface CachedCollection {
    /** Configuration de la collection */
    collection: TestCollection;
    
    /** Liste des fichiers de test trouvés */
    files: vscode.Uri[];
    
    /** Liste de toutes les méthodes de test trouvées */
    methods: TestMethod[];
    
    /** Liste des fichiers de test avec leurs métriques */
    testFiles: TestFile[];
    
    /** Date du dernier scan de cette collection */
    lastScan: Date;
}

/**
 * Interface pour la structure JSON du cache persistant
 */
export interface JsonCacheData {
    /** Collections indexées par nom */
    collections: {[key: string]: {
        /** Configuration de la collection */
        collection: TestCollection;
        
        /** Chemins des fichiers (string pour sérialisation JSON) */
        files: string[];
        
        /** Méthodes de test avec dates sérialisées */
        methods: TestMethod[];
        
        /** Fichiers de test avec dates sérialisées */
        testFiles: TestFile[];
        
        /** Date du dernier scan (string pour sérialisation JSON) */
        lastScan: string;
    }};
    
    /** Date de dernière mise à jour du cache global */
    lastUpdate: string;
}