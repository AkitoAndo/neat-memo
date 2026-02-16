import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import AuthView from './components/auth/AuthView.jsx';
import ProjectListView from './components/projects/ProjectListView.jsx';
import CanvasView from './components/canvas/CanvasView.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import ToastContainer from './components/common/ToastContainer.jsx';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthView />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ProjectListView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <CanvasView />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
