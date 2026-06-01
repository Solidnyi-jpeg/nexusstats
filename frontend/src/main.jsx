import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Імпортуємо головний компонент
import './index.css';       // Глобальні стилі

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);