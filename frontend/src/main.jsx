import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { installDemoApi } from './demoApi';

if (import.meta.env.VITE_DEMO === 'true') installDemoApi();
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
