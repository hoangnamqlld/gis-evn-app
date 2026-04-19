// index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import CSS sau cùng

console.log('🚀 Ứng dụng đang khởi động...');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Không tìm thấy element #root!');
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('✅ Ứng dụng đã render thành công');
  } catch (error) {
    console.error('❌ Lỗi khi render:', error);
    rootElement.innerHTML = `
      <div style="padding:20px;color:red">
        <h3>Lỗi: ${error instanceof Error ? error.message : String(error)}</h3>
      </div>
    `;
  }
}