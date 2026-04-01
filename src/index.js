// ============================================================
// APPLICATION ENTRY POINT
// ============================================================

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
                    background: '#1e293b',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    fontSize: '14px',
                    padding: '12px 16px',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                  },
                  success: {
                    iconTheme: { primary: '#22c55e', secondary: '#0f172a' },
                    style: { borderColor: '#22c55e33' },
                  },
                  error: {
                    iconTheme: { primary: '#ef4444', secondary: '#0f172a' },
                    style: { borderColor: '#ef444433' },
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
