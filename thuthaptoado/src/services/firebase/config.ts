// src/services/firebase/config.ts

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// KHÔNG CẦN khai báo interface ImportMeta nữa - Vite đã có sẵn

// Hàm lấy biến môi trường an toàn
const getEnvVar = (key: string): string => {
  try {
    // Trong môi trường Vite/Vercel
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const value = import.meta.env[key];
      if (value && typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
    
    // Fallback cho môi trường Node.js
    if (typeof process !== 'undefined' && process.env) {
      const value = process.env[key];
      if (value && typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Không thể đọc biến môi trường ${key}:`, error);
  }
  
  return '';
};

// Debug: Log tất cả biến môi trường có prefix VITE_
console.log('🔍 Kiểm tra biến môi trường VITE_:');
if (typeof import.meta !== 'undefined' && import.meta.env) {
  const viteVars = Object.keys(import.meta.env)
    .filter(key => key.startsWith('VITE_'))
    .reduce((obj, key) => {
      obj[key] = import.meta.env[key] ? '✅' : '❌';
      return obj;
    }, {} as Record<string, string>);
  console.log(viteVars);
}

// Lấy cấu hình Firebase
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID')
};

// Kiểm tra cấu hình
const missingVars = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn('⚠️ Thiếu các biến môi trường Firebase:', missingVars);
} else {
  console.log('✅ Đủ biến môi trường Firebase');
}

// Log cấu hình (ẩn key nhạy cảm)
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? '✅' : '❌',
  authDomain: firebaseConfig.authDomain ? '✅' : '❌',
  projectId: firebaseConfig.projectId ? '✅' : '❌',
  storageBucket: firebaseConfig.storageBucket ? '✅' : '❌',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✅' : '❌',
  appId: firebaseConfig.appId ? '✅' : '❌'
});

// Khởi tạo Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

try {
  // Kiểm tra cấu hình trước khi khởi tạo
  if (!firebaseConfig.apiKey) {
    throw new Error('Missing Firebase API Key');
  }

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

export { app, db, auth, storage };
export default app;