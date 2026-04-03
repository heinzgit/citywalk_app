import { useState } from 'react'
import UploadMap from './components/UploadMap'
import MapCanvas from './components/MapCanvas'
import './App.css'

export interface MapMeta {
  id: string
  filename: string
  originalName: string
  width: number
  height: number
}

export default function App() {
  const [map, setMap] = useState<MapMeta | null>(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>CityWalk</h1>
        {map && (
          <button className="btn-secondary" onClick={() => setMap(null)}>
            换地图
          </button>
        )}
      </header>

      {!map ? (
        <UploadMap onUploaded={setMap} />
      ) : (
        <MapCanvas map={map} />
      )}
    </div>
  )
}
