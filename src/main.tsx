import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startSession } from './state/session';
import { applyTheme, useSettings } from './state/settingsStore';
import './styles/tokens.css';
import './styles/base.css';
import './styles/sld.css';

applyTheme(useSettings.getState().theme);
startSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
