import { useState } from 'react'
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
}

type View = 'list' | 'upload' | 'canvas'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [map, setMap] = useState<MapMeta | null>(null)

  function handleSelect(m: MapMeta) {
    setMap(m)
    setView('canvas')
  }

  function handleUploaded(m: MapMeta) {
    setMap(m)
    setView('canvas')
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
        {view === 'canvas' && map && (
          <span className="app-header-sub">{map.originalName ?? map.original_name}</span>
        )}
        {view === 'upload' && (
          <button className="btn-secondary" onClick={() => setView('list')}>← 返回</button>
        )}
        {view === 'canvas' && (
          <button className="btn-secondary" onClick={() => setView('list')}>← 地图列表</button>
        )}
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
