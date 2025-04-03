import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { TasksProvider } from './hooks/useTasksContext';
import ReCaptchaProvider from './components/ReCaptchaProvider';
import { useCaseDefinitions } from './utils/useCaseDefinitions';
import { Helmet, HelmetProvider } from 'react-helmet-async';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Create routes for each use case
const useCaseRoutes = Object.entries(useCaseDefinitions).map(([id, definition]) => (
  <Route
    key={id}
    path={`/${definition.label.toLowerCase().replace(/\s+/g, '-')}`}
    element={
      <>
        <Helmet>
          <title>{definition.label} | AI To-Do Lists & Project Planning | TaskSmasher</title>
          <meta name="description" content={`Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools. ${definition.description.substring(0, 70)}`} />
          <meta name="keywords" content={`${definition.label}, AI To-Do Lists, Project Planning, Task Management, ${definition.keywords.slice(0, 5).join(', ')}`} />
          <link rel="canonical" href={`https://smashingapps.ai/${definition.label.toLowerCase().replace(/\s+/g, '-')}`} />
          <meta property="og:title" content={`${definition.label} | AI To-Do Lists & Project Planning | TaskSmasher`} />
          <meta property="og:description" content={`Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools. ${definition.description.substring(0, 70)}`} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`https://smashingapps.ai/${definition.label.toLowerCase().replace(/\s+/g, '-')}`} />
          <meta property="og:image" content="https://smashingapps.ai/assets/AITaskSmasher-small.png" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={`${definition.label} | AI To-Do Lists & Project Planning | TaskSmasher`} />
          <meta name="twitter:description" content={`Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools.`} />
          <meta name="twitter:image" content="https://smashingapps.ai/assets/AITaskSmasher-small.png" />
        </Helmet>
        <TasksProvider initialUseCase={id}>
          <App />
        </TasksProvider>
      </>
    }
  />
));

createRoot(root).render(
  <React.StrictMode>
    <HelmetProvider>
      <ReCaptchaProvider>
        <TasksProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={
                <>
                  <Helmet>
                    <title>TaskSmasher | AI To-Do Lists & Project Planning Tool</title>
                    <meta name="description" content="TaskSmasher helps you organize tasks with AI To-Do Lists & Project Planning tools. Create, manage, and complete tasks efficiently with AI assistance." />
                    <meta name="keywords" content="AI To-Do Lists, Project Planning, Task Management, Productivity, Organization, AI Assistant" />
                    <link rel="canonical" href="https://smashingapps.ai/" />
                    <meta property="og:title" content="TaskSmasher | AI To-Do Lists & Project Planning Tool" />
                    <meta property="og:description" content="TaskSmasher helps you organize tasks with AI To-Do Lists & Project Planning tools. Create, manage, and complete tasks efficiently with AI assistance." />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="https://smashingapps.ai/" />
                    <meta property="og:image" content="https://smashingapps.ai/assets/AITaskSmasher-small.png" />
                    <meta name="twitter:card" content="summary" />
                    <meta name="twitter:title" content="TaskSmasher - AI-powered Task Management" />
                    <meta name="twitter:description" content="TaskSmasher is an AI-powered task management application that helps you organize and manage your tasks efficiently." />
                    <meta name="twitter:image" content="https://smashingapps.ai/assets/AITaskSmasher-small.png" />
                  </Helmet>
                  <TasksProvider initialUseCase="daily">
                    <App />
                  </TasksProvider>
                </>
              } />
              {useCaseRoutes}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TasksProvider>
      </ReCaptchaProvider>
    </HelmetProvider>
  </React.StrictMode>
);