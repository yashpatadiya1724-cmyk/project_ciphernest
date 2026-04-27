import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider } from './context/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import LoadingScreen from './components/common/LoadingScreen'

// Lazy load pages
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const WiFiGuard = lazy(() => import('./pages/WiFiGuard'))
const NetworkMap = lazy(() => import('./pages/NetworkMap'))
const ThreatMap = lazy(() => import('./pages/ThreatMap'))
const ProcessWatcher = lazy(() => import('./pages/ProcessWatcher'))
const AskCipher = lazy(() => import('./pages/AskCipher'))
const Vault = lazy(() => import('./pages/Vault'))
const Honeypot = lazy(() => import('./pages/Honeypot'))
const GlobalDashboard = lazy(() => import('./pages/GlobalDashboard'))

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="global-intel" element={<GlobalDashboard />} />
                  <Route path="tools" element={<ToolsPage />} />
                  <Route path="tools/:toolId" element={<ToolsPage />} />
                  <Route path="wifi" element={<WiFiGuard />} />
                  <Route path="network" element={<NetworkMap />} />
                  <Route path="threats" element={<ThreatMap />} />
                  <Route path="processes" element={<ProcessWatcher />} />
                  <Route path="cipher" element={<AskCipher />} />
                  <Route path="vault" element={<Vault />} />
                  <Route path="honeypot" element={<Honeypot />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
