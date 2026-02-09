/**
 * Application Entry Point
 * Loads runtime config (AppSync endpoints from CDK) before mounting.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { loadRuntimeConfig } from './config/aws-config';
import App from './App';

loadRuntimeConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
