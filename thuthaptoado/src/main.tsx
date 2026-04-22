import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'leaflet/dist/leaflet.css';
// Font Inter — chân phương, hỗ trợ tiếng Việt, offline
// Nạp đủ weight code đang dùng (font-medium 500 → font-black 900) để tránh
// trình duyệt giả lập bold khiến chữ đậm không đồng nhất.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';

// Service Worker — cache tile bản đồ + response API để chạy offline
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
