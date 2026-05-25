import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AlbumDetailPage } from './pages/AlbumDetailPage'
import { AlbumsPage } from './pages/AlbumsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AlbumsPage />} />
      <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
