import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import Auth from './pages/Auth'
import MapList from './components/MapList'
import UploadMap from './components/UploadMap'
import MapCanvas from './components/MapCanvas'
import './App.css'

export interface MapMeta {
  id: string
  filename: string
  originalName?: string
  original_name?: string
  width: number
  height: number
  scale?: number | null
}

type View = 'list' | 'upload' | 'canvas'

export default function App() {
  const { user, loading, logout } = useAuth()
  const [view, setView] = useState<View>('list')
  const [map, setMap] = useState<MapMeta | null>(null)

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <Auth />
      </div>
    )
  }

  function handleSelect(m: MapMeta) {
    setMap(m)
    setView('canvas')
  }

  function handleUploaded(m: MapMeta) {
    setMap(m)
    setView('canvas')
  }

  function handleLogout() {
    logout()
    setView('list')
    setMap(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1
          style={{ cursor: view !== 'list' ? 'pointer' : 'default' }}
          onClick={() => { if (view !== 'list') setView('list') }}
        >
          CityWalk
        </h1>
        <span className="app-header-user">{user.username}</span>
        {view === 'canvas' && map && (
          <span className="app-header-sub">{map.originalName ?? map.original_name}</span>
        )}
        {view !== 'list' && (
          <button className="btn-secondary" onClick={() => setView('list')}>← 地图列表</button>
        )}
        <button className="btn-ghost btn" onClick={handleLogout}>退出</button>
      </header>

      {view === 'list' && (
        <MapList onSelect={handleSelect} onUpload={() => setView('upload')} />
      )}
      {view === 'upload' && (
        <UploadMap onUploaded={handleUploaded} />
      )}
      {view === 'canvas' && map && (
        <MapCanvas map={map} />
      )}
    </div>
  )
}
