import { useState, useRef } from 'react'
import type { MapMeta } from '../App'
import styles from './UploadMap.module.css'

interface Props {
  onUploaded: (map: MapMeta) => void
}

export default function UploadMap({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setError(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/maps', { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json()).error ?? '上传失败')
      const data: MapMeta = await res.json()
      onUploaded(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setLoading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    upload(files[0])
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <span className={styles.icon}>🗺️</span>
        <p className={styles.hint}>点击或拖拽地图图片到这里</p>
        <p className={styles.sub}>支持 JPG / PNG / WebP，最大 50 MB</p>
        {loading && <p className={styles.loading}>上传中...</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
