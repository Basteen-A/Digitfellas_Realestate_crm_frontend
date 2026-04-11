// ============================================================
// APPLICATION ENTRY POINT
// ===========================================================


import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { store } from './redux/store';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { AuthProvider } from './contexts/AuthContext';
import './styles/variables.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/typography.css';
import './styles/utilities.css';
import './styles/animations.css';
import './styles/propcrm.css';
import './styles/responsive.css';
import './styles/tailwind.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <SidebarProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--border-radius-lg)',
                    fontSize: '14px',
                    padding: '12px 16px',
                    boxShadow: 'var(--shadow-lg)',
                  },
                  success: {
                    iconTheme: { primary: 'var(--accent-green)', secondary: 'var(--bg-card)' },
                    style: { borderColor: 'var(--accent-green)' },
                  },
                  error: {
                    iconTheme: { primary: 'var(--accent-red)', secondary: 'var(--bg-card)' },
                    style: { borderColor: 'var(--accent-red)' },
                    duration: 5000,
                  },
                }}
              />
            </BrowserRouter>
          </AuthProvider>
        </SidebarProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
