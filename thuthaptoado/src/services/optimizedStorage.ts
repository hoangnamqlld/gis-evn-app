// src/services/optimizedStorage.ts
// Service lưu trữ tối ưu với IndexedDB

class OptimizedStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('EVNHCMC_DB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      };
    });
  }

  async saveAssets(assets: any[]): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    const tx = this.db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');
    
    for (const asset of assets) {
      store.put(asset);
    }
  }

  async getAssets(): Promise<any[]> {
    await this.initPromise;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export default new OptimizedStorage();