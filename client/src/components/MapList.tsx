import { useEffect, useRef, useState } from 'react'
import type { MapMeta } from '../App'
import styles from './MapList.module.css'

interface Props {
  onSelect: (map: MapMeta) => void
  onUpload: () => void
}

export default function MapList({ onSelect, onUpload }: Props) {
  const [maps, setMaps] = useState<MapMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMaps()
  }, [])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  function fetchMaps() {
    setLoading(true)
    fetch('/api/maps')
      .then(r => r.json())
      .then(data => { setMaps(data); setLoading(false) })
      .catch(() => { setError('加载地图列表失败'); setLoading(false) })
  }

  function startRename(e: React.MouseEvent, map: MapMeta) {
    e.stopPropagation()
    setRenamingId(map.id)
    setRenameValue(map.original_name ?? map.originalName ?? '')
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) { cancelRename(); return }
    await fetch(`/api/maps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    setMaps(prev => prev.map(m => m.id === id ? { ...m, original_name: renameValue.trim(), originalName: renameValue.trim() } : m))
    cancelRename()
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function startDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeletingId(id)
  }

  async function confirmDelete() {
    if (!deletingId) return
    await fetch(`/api/maps/${deletingId}`, { method: 'DELETE' })
    setMaps(prev => prev.filter(m => m.id !== deletingId))
    setDeletingId(null)
  }

  if (loading) return <div className={styles.center}>加载中...</div>
  if (error) return <div className={`${styles.center} ${styles.errorText}`}>{error}</div>

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.count}>{maps.length} 张地图</span>
        <button className={styles.btnPrimary} onClick={onUpload}>+ 上传新地图</button>
      </div>

      <div className={styles.grid}>
        {maps.map(map => {
          const displayName = map.original_name ?? map.originalName ?? ''
          const isRenaming = renamingId === map.id
          return (
            <div
              key={map.id}
              className={styles.card}
              onClick={() => !isRenaming && onSelect(map)}
            >
              <div className={styles.thumb}>
                <img src={`/uploads/${map.filename}`} alt={displayName} draggable={false} />
                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                  <button className={styles.actionBtn} title="重命名" onClick={e => startRename(e, map)}>✏️</button>
                  <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="删除" onClick={e => startDelete(e, map.id)}>🗑</button>
                </div>
              </div>
              <div className={styles.info}>
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className={styles.renameInput}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitRename(map.id)
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={() => submitRename(map.id)}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.name}>{displayName}</span>
                )}
                <span className={styles.size}>{map.width} × {map.height}</span>
              </div>
            </div>
          )
        })}

        {maps.length === 0 && (
          <div className={styles.empty}>还没有地图，点击右上角上传一张吧</div>
        )}
      </div>

      {deletingId && (
        <div className={styles.overlay} onClick={() => setDeletingId(null)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <p>确认删除这张地图？相关路线也会一并删除，无法恢复。</p>
            <div className={styles.dialogActions}>
              <button className={styles.btnSecondary} onClick={() => setDeletingId(null)}>取消</button>
              <button className={styles.btnDanger} onClick={confirmDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
