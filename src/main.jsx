import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.base.css';
import './styles.css';
import './styles.motion.css';
import './styles.scene.css';
import './styles.fx.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: cài được lên màn hình chính, mở được khi mất mạng (chỉ bản build, không chạy khi dev)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
