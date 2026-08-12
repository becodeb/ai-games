import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast.jsx'
import StudentHome from './pages/StudentHome.jsx'
import NewGame from './pages/NewGame.jsx'
import StudentProject from './pages/StudentProject.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DashboardProject from './pages/DashboardProject.jsx'
import Gallery from './pages/Gallery.jsx'
import Play from './pages/Play.jsx'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/nuevo" element={<NewGame />} />
        <Route path="/proyecto/:id" element={<StudentProject />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:id" element={<DashboardProject />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/jugar/:iterationId" element={<Play />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
