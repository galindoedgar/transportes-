import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';  // ← Cambiado a app.js

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);