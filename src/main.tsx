import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {NodeUnlockProvider} from './context/NodeUnlockContext.tsx';
import {installAuthFetchInterceptor} from './lib/auth-client.ts';
import {initPwaServiceWorker} from './lib/pwa-register.ts';
import {applyDocumentTheme, loadSavedTheme} from './lib/theme.ts';

installAuthFetchInterceptor();
applyDocumentTheme(loadSavedTheme());
initPwaServiceWorker();

createRoot(document.getElementById('root')!).render(
  <NodeUnlockProvider>
    <App />
  </NodeUnlockProvider>
);

