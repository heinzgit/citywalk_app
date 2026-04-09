import { useState, useRef } from 'react'
import type { Route, Group } from './MapCanvas'
import styles from './RouteList.module.css'

interface Props {
  routes: Route[]
  groups: Group[]
  selectedId: string | null
  drawing: boolean
  scale: number | null
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onMove: (id: string, groupId: string | null) => void
  onDelete: (id: string) => void
  onCreateGroup: (name: string) => void
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onToggleRouteVisible: (id: string) => void
  onToggleGroupVisible: (id: string) => void
  onStartDraw: () => void
  onCancelDraw: () => void
  onSetScale: (scale: number) => void
}

function pixelLength(points: [number, number][]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    d += Math.sqrt(dx * dx + dy * dy)
  }
  return d
}

function formatLength(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' km'
  if (meters >= 100) return Math.round(meters) + ' m'
  return meters.toFixed(1) + ' m'
}

export default function RouteList({
  routes, groups, selectedId, drawing, scale,
  onSelect, onRename, onRecolor, onMove, onDelete,
  onCreateGroup, onRenameGroup, onDeleteGroup,
  onToggleRouteVisible, onToggleGroupVisible,
  onStartDraw, onCancelDraw, onSetScale,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  // Scale calibration state
  const [calibOpen, setCalibOpen] = useState(false)
  const [calibRouteId, setCalibRouteId] = useState('')
  const [calibLength, setCalibLength] = useState('')

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function beginEditRoute(route: Route) {
    setEditingRouteId(route.id)
    setEditValue(route.name)
  }

  function commitEditRoute(id: string) {
    if (editValue.trim()) onRename(id, editValue.trim())
    setEditingRouteId(null)
  }

  function beginEditGroup(group: Group) {
    setEditingGroupId(group.id)
    setEditValue(group.name)
  }

  function commitEditGroup(id: string) {
    if (editValue.trim()) onRenameGroup(id, editValue.trim())
    setEditingGroupId(null)
  }

  function handleCreateGroup() {
    const name = prompt('文件夹名称:')
    if (name?.trim()) onCreateGroup(name.trim())
  }

  function handleCalibrate() {
    const route = routes.find(r => r.id === calibRouteId)
    if (!route) return
    const pxLen = pixelLength(route.points)
    if (pxLen === 0) return
    const realMeters = parseFloat(calibLength)
    if (!realMeters || realMeters <= 0) return
    onSetScale(realMeters / pxLen)
    setCalibOpen(false)
    setCalibRouteId('')
    setCalibLength('')
  }

  function renderRoute(route: Route, indented = false) {
    const pxLen = pixelLength(route.points)
    const realLen = scale && pxLen > 0 ? pxLen * scale : null
    return (
      <li
        key={route.id}
        className={`${styles.item} ${indented ? styles.indented : ''} ${selectedId === route.id ? styles.selected : ''}`}
        onClick={() => onSelect(route.id)}
      >
        <button
          className={`btn-ghost ${styles.visibleToggle}`}
          title={route.visible ? "隐藏路线" : "显示路线"}
          onClick={e => { e.stopPropagation(); onToggleRouteVisible(route.id) }}
        >
          {route.visible ? '👁' : '🙈'}
        </button>

        <input
          type="color"
          className={styles.colorPicker}
          value={route.color}
          onClick={e => e.stopPropagation()}
          onChange={e => onRecolor(route.id, e.target.value)}
          title="修改颜色"
        />

        <div className={styles.nameBlock}>
          {editingRouteId === route.id ? (
            <input
              className={styles.editInput}
              value={editValue}
              autoFocus
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitEditRoute(route.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEditRoute(route.id)
                if (e.key === 'Escape') setEditingRouteId(null)
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className={styles.name}>{route.name}</span>
          )}
          {realLen !== null && (
            <span className={styles.lengthBadge}>{formatLength(realLen)}</span>
          )}
        </div>

        <div className={styles.actions}>
          <select
            className={styles.folderSelect}
            value={route.group_id ?? ''}
            onChange={e => { onMove(route.id, e.target.value || null); }}
            onClick={e => e.stopPropagation()}
            title="移动到文件夹"
          >
            <option value="">根目录</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button
            className="btn-ghost"
            title="重命名"
            onClick={e => { e.stopPropagation(); beginEditRoute(route) }}
          >✎</button>
          <button
            className="btn-danger"
            title="删除"
            onClick={e => {
              e.stopPropagation()
              if (confirm(`删除路线「${route.name}」？`)) onDelete(route.id)
            }}
          >✕</button>
        </div>
      </li>
    )
  }

  const ungrouped = routes.filter(r => !r.group_id)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>路线列表</span>
        <div className={styles.headerBtns}>
          <button
            className="btn-ghost"
            title="新建文件夹"
            onClick={handleCreateGroup}
          >📁+</button>
          <button
            className={`btn-primary ${styles.drawBtn}`}
            onClick={drawing ? onCancelDraw : onStartDraw}
          >
            {drawing ? '✕ 取消' : '+ 画路线'}
          </button>
        </div>
      </div>

      {/* Scale calibration section */}
      <div className={styles.scaleSection}>
        <div className={styles.scaleRow}>
          <span className={styles.scaleIcon}>📏</span>
          <span className={styles.scaleLabel}>比例尺</span>
          {scale
            ? <span className={styles.scaleValue}>{formatLength(scale * 100)}/百像素</span>
            : <span className={styles.scaleUnset}>未设置</span>
          }
          <button
            className={`btn-ghost ${styles.calibBtn}`}
            onClick={() => setCalibOpen(v => !v)}
          >
            {calibOpen ? '收起' : (scale ? '重新校准' : '校准')}
          </button>
        </div>

        {calibOpen && (
          <div className={styles.calibForm}>
            <select
              className={styles.calibSelect}
              value={calibRouteId}
              onChange={e => setCalibRouteId(e.target.value)}
            >
              <option value="">— 选择参考路线 —</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className={styles.calibInputRow}>
              <input
                type="number"
                className={styles.calibInput}
                placeholder="实际长度"
                min="0.1"
                step="any"
                value={calibLength}
                onChange={e => setCalibLength(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCalibrate()}
              />
              <span className={styles.calibUnit}>米</span>
              <button
                className={`btn-primary ${styles.calibConfirm}`}
                disabled={!calibRouteId || !calibLength || parseFloat(calibLength) <= 0}
                onClick={handleCalibrate}
              >确定</button>
            </div>
            {calibRouteId && (() => {
              const r = routes.find(x => x.id === calibRouteId)
              if (!r) return null
              const px = pixelLength(r.points)
              return <p className={styles.calibHint}>该路线像素长度：{Math.round(px)} px</p>
            })()}
          </div>
        )}
      </div>

      {routes.length === 0 && groups.length === 0 && !drawing && (
        <p className={styles.empty}>点击「画路线」开始绘制</p>
      )}

      <ul className={styles.list} ref={newGroupInputRef as unknown as React.RefObject<HTMLUListElement>}>
        {groups.map(group => {
          const groupRoutes = routes.filter(r => r.group_id === group.id)
          const isCollapsed = collapsed.has(group.id)
          return (
            <li key={group.id} className={styles.groupItem}>
              <div
                className={styles.groupHeader}
                onClick={() => toggleCollapse(group.id)}
              >
                <button
                  className={`btn-ghost ${styles.visibleToggle}`}
                  title={group.visible ? "隐藏文件夹内路线" : "显示文件夹内路线"}
                  onClick={e => { e.stopPropagation(); onToggleGroupVisible(group.id) }}
                >
                  {group.visible ? '👁' : '🙈'}
                </button>
                <span className={styles.arrow}>{isCollapsed ? '▶' : '▼'}</span>
                {editingGroupId === group.id ? (
                  <input
                    className={styles.editInput}
                    value={editValue}
                    autoFocus
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitEditGroup(group.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEditGroup(group.id)
                      if (e.key === 'Escape') setEditingGroupId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.groupName}>{group.name}</span>
                )}
                <span className={styles.groupCount}>{groupRoutes.length}</span>
                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-ghost"
                    title="重命名"
                    onClick={() => beginEditGroup(group)}
                  >✎</button>
                  <button
                    className="btn-danger"
                    title="删除文件夹"
                    onClick={() => {
                      if (confirm(`删除文件夹「${group.name}」？其中路线将移至根目录。`)) onDeleteGroup(group.id)
                    }}
                  >✕</button>
                </div>
              </div>
              {!isCollapsed && (
                <ul className={styles.groupRoutes}>
                  {groupRoutes.map(r => renderRoute(r, true))}
                  {groupRoutes.length === 0 && (
                    <li className={styles.emptyGroup}>（空文件夹）</li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
        {ungrouped.map(r => renderRoute(r, false))}
      </ul>
    </aside>
  )
}
