import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast.jsx'
import StudentHome from './pages/StudentHome.jsx'
import NewGame from './pages/NewGame.jsx'
import StudentProject from './pages/StudentProject.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DashboardProject from './pages/DashboardProject.jsx'
import Gallery from './pages/Gallery.jsx'
import Play from './pages/Play.jsx'
import NewImage from './pages/NewImage.jsx'
import ImageProject from './pages/ImageProject.jsx'
import ImageDashboard from './pages/ImageDashboard.jsx'
import ImageDashboardProject from './pages/ImageDashboardProject.jsx'
import ImageGallery from './pages/ImageGallery.jsx'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<StudentHome />} />

        {/* taller de juegos */}
        <Route path="/nuevo" element={<NewGame />} />
        <Route path="/proyecto/:id" element={<StudentProject />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:id" element={<DashboardProject />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/jugar/:iterationId" element={<Play />} />

        {/* taller de imagenes */}
        <Route path="/nueva-imagen" element={<NewImage />} />
        <Route path="/imagen/:id" element={<ImageProject />} />
        <Route path="/dashboard-imagenes" element={<ImageDashboard />} />
        <Route path="/dashboard-imagenes/:id" element={<ImageDashboardProject />} />
        <Route path="/galeria-imagenes" element={<ImageGallery />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
