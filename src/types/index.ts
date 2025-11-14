/**
 * Types principaux pour PHP Test Collections Explorer
 * 
 * Ce module exporte tous les types et interfaces utilisés
 * dans l'extension pour la gestion des tests PHP.
 */

// Collections et configuration
export { TestCollection } from './TestCollection';

// Tests et statuts
export { TestMethod, TestStatus } from './TestMethod';

// Fichiers de test avec métriques
export { TestFile } from './TestFile';

// Cache et persistance
export { CachedCollection, JsonCacheData } from './Cache';