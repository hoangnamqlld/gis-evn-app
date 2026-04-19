// src/services/syncQueueService.ts
import dualSyncService from './dualSyncService';

interface SyncTask {
  id: string;
  type: 'asset' | 'photo' | 'sheet';
  data: any;
  retryCount: number;
  lastAttempt: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
}

class SyncQueueService {
  private queue: SyncTask[] = [];
  private isProcessing = false;
  private readonly MAX_RETRY = 5;
  private readonly RETRY_DELAY = [5000, 15000, 30000, 60000, 120000];
  
  constructor() {
    this.loadFromIndexedDB();
    this.setupNetworkListener();
  }
  
  private setupNetworkListener() {
    window.addEventListener('online', () => {
      console.log('📶 Mạng đã kết nối, xử lý queue...');
      this.processQueue();
    });
  }
  
  async addToQueue(task: Omit<SyncTask, 'id' | 'retryCount' | 'lastAttempt' | 'status'>) {
    const newTask: SyncTask = {
      id: this.generateTaskId(),
      ...task,
      retryCount: 0,
      lastAttempt: Date.now(),
      status: 'pending'
    };
    
    this.queue.push(newTask);
    await this.saveToIndexedDB();
    
    console.log(`📦 Thêm vào queue: ${newTask.id} (${task.type})`);
    
    if (navigator.onLine) {
      this.processQueue();
    }
    
    return newTask.id;
  }
  
  private generateTaskId(): string {
    return `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async processQueue() {
    if (this.isProcessing) {
      console.log('⏳ Queue đang xử lý...');
      return;
    }
    
    if (!this.queue || !Array.isArray(this.queue)) {
      this.queue = [];
      return;
    }
    
    if (this.queue.length === 0) {
      console.log("📭 Hàng đợi trống");
      return;
    }
    
    if (!navigator.onLine) {
      console.log('📶 Không có kết nối mạng, tạm dừng xử lý queue');
      return;
    }
    
    this.isProcessing = true;
    console.log(`🔄 Xử lý queue (${this.queue.length} tasks)...`);
    
    const pendingTasks = this.queue.filter(t => t && t.status === 'pending');
    
    for (const task of pendingTasks) {
      try {
        task.status = 'processing';
        await this.executeTask(task);
        
        task.status = 'completed';
        this.queue = this.queue.filter(t => t.id !== task.id);
        
        console.log(`✅ Task hoàn thành: ${task.id}`);
        
        window.dispatchEvent(new CustomEvent('sync-update', {
          detail: { 
            completed: task.id,
            pending: this.getPendingCount(),
            failed: this.getFailedCount()
          }
        }));
        
      } catch (error: any) {
        console.error(`❌ Lỗi task ${task.id}:`, error);
        
        task.retryCount++;
        task.lastAttempt = Date.now();
        task.status = 'failed';
        task.error = error.message || 'Lỗi không xác định';
        
        if (task.retryCount < this.MAX_RETRY) {
          const delay = this.RETRY_DELAY[task.retryCount - 1] || 120000;
          console.log(`🔄 Sẽ thử lại sau ${delay/1000}s (lần ${task.retryCount}/${this.MAX_RETRY})`);
          
          setTimeout(() => {
            task.status = 'pending';
            this.processQueue();
          }, delay);
        } else {
          console.error('❌ Task thất bại vĩnh viễn:', task);
        }
      }
      
      await this.saveToIndexedDB();
    }
    
    this.isProcessing = false;
  }
  
  private async executeTask(task: SyncTask) {
    switch (task.type) {
      case 'asset':
        await dualSyncService.syncToFirebase(task.data);
        break;
        
      case 'photo':
        const { default: drivePhotoService } = await import('./drivePhotoService');
        const urls = await drivePhotoService.uploadAssetPhotos(
          task.data.asset,
          task.data.photos
        );
        if (task.data.asset) {
          task.data.asset.photoUrls = urls;
        }
        break;
        
      case 'sheet':
        const { default: googleSheetsService } = await import('./googleSheetsService');
        await googleSheetsService.appendAsset(task.data);
        break;
        
      default:
        throw new Error(`Loại task không hỗ trợ: ${task.type}`);
    }
  }
  
  getPendingCount(): number {
    if (!this.queue || !Array.isArray(this.queue)) return 0;
    return this.queue.filter(t => t && t.status === 'pending').length;
  }
  
  getFailedCount(): number {
    if (!this.queue || !Array.isArray(this.queue)) return 0;
    return this.queue.filter(t => t && t.status === 'failed').length;
  }
  
  getAllTasks(): SyncTask[] {
    return this.queue || [];
  }
  
  async retryFailed() {
    if (!this.queue || !Array.isArray(this.queue)) {
      this.queue = [];
      return;
    }
    
    let retryCount = 0;
    this.queue.forEach(t => {
      if (t && t.status === 'failed') {
        t.status = 'pending';
        t.retryCount = 0;
        t.error = undefined;
        retryCount++;
      }
    });
    
    if (retryCount > 0) {
      await this.saveToIndexedDB();
      console.log(`🔄 Đã đánh dấu ${retryCount} tasks để thử lại`);
      this.processQueue();
    }
  }
  
  async clearCompleted() {
    if (!this.queue || !Array.isArray(this.queue)) {
      this.queue = [];
      return;
    }
    
    const beforeCount = this.queue.length;
    this.queue = this.queue.filter(t => t.status !== 'completed');
    
    if (beforeCount !== this.queue.length) {
      await this.saveToIndexedDB();
      console.log(`🗑️ Đã xóa ${beforeCount - this.queue.length} tasks hoàn thành`);
    }
  }
  
  private async saveToIndexedDB() {
    try {
      const db = await this.openDB();
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      
      return new Promise<void>((resolve, reject) => {
        // Lưu toàn bộ queue với key 'sync-queue'
        const request = store.put({ 
          id: 'sync-queue', 
          data: this.queue || [] 
        });
        
        request.onsuccess = () => {
          console.log('💾 Đã lưu queue vào IndexedDB');
          resolve();
        };
        
        request.onerror = () => {
          console.error('❌ Lỗi lưu IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ Lỗi lưu queue:', error);
      this.saveToLocalStorage();
      return Promise.resolve();
    }
  }
  
  private saveToLocalStorage() {
    try {
      localStorage.setItem('sync_queue_backup', JSON.stringify(this.queue || []));
      console.log('💾 Đã lưu queue vào localStorage (backup)');
    } catch (e) {
      console.error('❌ Lỗi lưu localStorage:', e);
    }
  }
  
  private async loadFromIndexedDB() {
    try {
      const db = await this.openDB();
      const tx = db.transaction('queue', 'readonly');
      const store = tx.objectStore('queue');
      
      return new Promise<void>((resolve) => {
        const request = store.get('sync-queue');
        
        request.onsuccess = () => {
          if (request.result && request.result.data && Array.isArray(request.result.data)) {
            this.queue = request.result.data;
            console.log(`📦 Đã load ${this.queue.length} tasks từ IndexedDB`);
          } else {
            console.log('📭 Không có dữ liệu trong IndexedDB, thử load từ localStorage');
            this.loadFromLocalStorage();
          }
          resolve();
        };
        
        request.onerror = () => {
          console.error('❌ Lỗi đọc IndexedDB:', request.error);
          this.loadFromLocalStorage();
          resolve();
        };
      });
    } catch (error) {
      console.error('❌ Lỗi load queue:', error);
      this.loadFromLocalStorage();
      return Promise.resolve();
    }
  }
  
  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('sync_queue_backup');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
          console.log(`📦 Đã load ${this.queue.length} tasks từ localStorage`);
        }
      } else {
        this.queue = [];
      }
    } catch (e) {
      console.error('❌ Lỗi load localStorage:', e);
      this.queue = [];
    }
  }
  
  // SỬA HÀM NÀY - QUAN TRỌNG NHẤT
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Tăng version lên 3 để force upgrade
      const request = indexedDB.open('SyncQueueDB', 3);
      
      request.onerror = () => {
        console.error('❌ Lỗi mở IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('✅ Kết nối IndexedDB thành công');
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 Nâng cấp IndexedDB schema...');
        
        // Xóa store cũ nếu tồn tại
        if (db.objectStoreNames.contains('queue')) {
          db.deleteObjectStore('queue');
          console.log('🗑️ Đã xóa object store cũ');
        }
        
        // Tạo store mới với keyPath 'id'
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        console.log('✅ Đã tạo object store mới với keyPath: id');
        
        // Tạo index nếu cần
        store.createIndex('by_status', 'status', { unique: false });
      };
    });
  }

  // Thêm hàm xóa toàn bộ queue
  async clearAll() {
    this.queue = [];
    await this.saveToIndexedDB();
    localStorage.removeItem('sync_queue_backup');
    console.log('🗑️ Đã xóa toàn bộ queue');
  }

  // Thêm hàm lấy thống kê
  getStats() {
    return {
      total: this.queue.length,
      pending: this.getPendingCount(),
      failed: this.getFailedCount(),
      completed: this.queue.filter(t => t.status === 'completed').length,
      processing: this.queue.filter(t => t.status === 'processing').length
    };
  }
}

export default new SyncQueueService();