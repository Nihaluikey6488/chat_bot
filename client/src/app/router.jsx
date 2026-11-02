import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from '../features/auth/hooks/useAuth'
import { ChatPage } from '../features/chat/ui/pages/ChatPage'
import { ForgotPasswordPage } from '../features/auth/ui/pages/ForgotPasswordPage'
import { LoginPage } from '../features/auth/ui/pages/LoginPage'
import { RegisterPage } from '../features/auth/ui/pages/RegisterPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      {
        path: 'chat',
        element: (
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/chat" replace /> },
    ],
  },
])
