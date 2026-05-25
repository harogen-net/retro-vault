import { IonApp } from '@ionic/react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AlbumDetailPage } from './pages/AlbumDetailPage'
import { AlbumsPage } from './pages/AlbumsPage'
import { PhotoViewPage } from './pages/PhotoViewPage'

function App() {
  return (
    <IonApp>
      <Routes>
        <Route path="/" element={<AlbumsPage />} />
        <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
        <Route path="/albums/:albumId/photos/:photoId" element={<PhotoViewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IonApp>
  )
}

export default App
