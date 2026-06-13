import React from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/tokens.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// 最外层兜底:连 header/rail 都崩溃的极端情况下也不至于整屏空白,
// 「重新加载」整窗口重载作为最后防线。
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary onReset={() => window.location.reload()}>
    <App />
  </ErrorBoundary>,
);
