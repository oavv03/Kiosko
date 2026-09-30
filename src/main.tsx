import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CustomizationProvider } from './context/CustomizationContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomizationProvider>
      <App />
    </CustomizationProvider>
  </StrictMode>,
);
