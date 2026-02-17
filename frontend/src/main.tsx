/**
 * Application Entry Point
 * Loads runtime config (AppSync endpoints from CDK) before mounting.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { loadRuntimeConfig } from './config/aws-config';
import App from './App';

/** Inlined at build time by Vite define; ensures bundle content (and filename hash) changes every build */
declare const __BUILD_TIMESTAMP__: string | undefined;
if (typeof __BUILD_TIMESTAMP__ !== 'undefined') {
  (window as unknown as { __buildTs?: string }).__buildTs = __BUILD_TIMESTAMP__;
}
loadRuntimeConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
