import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// КРИТИЧНО: Імпортуємо конфіг i18n, щоб працювали переклади у всьому застосунку!
// Якщо твій файл називається інакше (наприклад, i18n.js), зміни назву.
import './i18n/index.js'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);