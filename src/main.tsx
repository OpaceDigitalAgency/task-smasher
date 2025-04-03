import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TasksProvider } from './hooks/useTasksContext';
import ReCaptchaProvider from './components/ReCaptchaProvider';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <ReCaptchaProvider>
      <TasksProvider>
        <App />
      </TasksProvider>
    </ReCaptchaProvider>
  </React.StrictMode>
);