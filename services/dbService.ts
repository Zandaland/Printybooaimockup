import type { Project } from '../types';

const DB_NAME = 'ai-mockup-studio-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let db: IDBDatabase;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', (event.target as IDBRequest).error);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addProject = async (project: Project): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(project);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error adding project:', (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
};

export const getProject = async (id: string): Promise<Project | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = (event) => {
            console.error('Error getting project:', (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
};

export const updateProject = async (project: Project): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(project);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error updating project:', (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
};

export const deleteProject = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error deleting project:', (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
    });
};
