import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/artifact-editor.css';
import { ensureMindflowContextMapsSeed } from './lib/mindflowContextMapsSeed';

// Execute seeding on startup (will check if already exists)
ensureMindflowContextMapsSeed().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
