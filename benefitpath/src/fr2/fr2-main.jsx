import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Fr2App from './Fr2App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Fr2App />
  </StrictMode>
);
