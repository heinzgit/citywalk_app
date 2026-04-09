import { useState, useEffect, useRef, useCallback } from 'react'
import type { MapMeta } from '../App'
import { api } from '../api'
import RouteList from './RouteList'
import styles from './MapCanvas.module.css'

export interface Route {
  id: string
  map_id: string
  name: string
  points: [number, number][]
  color: string
  group_id: string | null
  visible: boolean
  created_at: string
}

export interface Group {
  id: string
  map_id: string
  name: string
  visible: boolean
  created_at: string
}

const DEFAULT_COLOR = '#fffb00'

interface Props {
  map: MapMeta
}

export default function MapCanvas({ map }: Props) {
  const [routes, setRoutes] = useState<Route[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState<number | null>(map.scale ?? null)

  // Drawing state
  const [drawing, setDrawing] = useState(false)
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([])
  const [mousePos, setMousePos] = useState<[number, number] | null>(null)

  // Edit mode state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editPoints, setEditPoints] = useState<[number, number][]>([])
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null)
  const [editInsertMode, setEditInsertMode] = useState(false)
  const draggingIdx = useRef<number | null>(null)

  // Pan/zoom state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ active: false, lastX: 0, lastY: 0, hasMoved: false, pointerId: -1, target: null as HTMLDivElement | null })

  const svgRef = useRef<SVGSVGElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [resizing, setResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Load data on mount
  useEffect(() => {
    api.get<Route[]>(`/api/maps/${map.id}/routes`)
      .then(routes => setRoutes(routes.map(r => ({ ...r, visible: true })))).catch(console.error)
    api.get<Group[]>(`/api/maps/${map.id}/groups`)
      .then(groups => setGroups(groups.map(g => ({ ...g, visible: true })))).catch(console.error)
  }, [map.id])

  // Init transform: center-fit the image
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (!wrap) return
    const wrapW = wrap.clientWidth
    const wrapH = wrap.clientHeight
    const pad = 40
    const s = Math.min((wrapW - pad * 2) / map.width, (wrapH - pad * 2) / map.height, 1)
    setTransform({ scale: s, x: (wrapW - map.width * s) / 2, y: (wrapH - map.height * s) / 2 })
  }, [map.width, map.height])

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { scale, x, y } = transformRef.current
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newScale = Math.max(0.05, Math.min(20, scale * factor))
      const ratio = newScale / scale
      setTransform({ scale: newScale, x: mx - (mx - x) * ratio, y: my - (my - y) * ratio })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Convert client coords to SVG/image coordinate space
  const clientToSvg = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    return [
      (clientX - rect.left) * (map.width / rect.width),
      (clientY - rect.top) * (map.height / rect.height),
    ]
  }, [map.width, map.height])

  const toSvgCoords = useCallback(
    (e: React.MouseEvent) => clientToSvg(e.clientX, e.clientY),
    [clientToSvg]
  )

  // ── Pan ──────────────────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    // Don't pan if the click target is a button or input
    if ((e.target as HTMLElement).closest('button, input, select')) return
    // Allow pan when: drawing (drag to pan, click to add point),
    // or not editing, or editing with no point selected and not inserting
    const canPan = drawing || !editingRouteId || (selectedPointIdx === null && !editInsertMode)
    if (!canPan) return
    panRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, hasMoved: false, pointerId: e.pointerId, target: e.currentTarget }
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panRef.current.active) return
    const dx = e.clientX - panRef.current.lastX
    const dy = e.clientY - panRef.current.lastY
    if (!panRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
      panRef.current.hasMoved = true
      setIsPanning(true)
      // Capture pointer only once drag starts, so clicks still reach SVG
      panRef.current.target?.setPointerCapture(panRef.current.pointerId)
    }
    if (panRef.current.hasMoved) {
      panRef.current.lastX = e.clientX
      panRef.current.lastY = e.clientY
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
  }
  function handlePointerUp() {
    panRef.current.active = false
    setIsPanning(false)
  }

  // ── Sidebar resize ───────────────────────────────────────
  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    setResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizing) return
    const dx = e.clientX - resizeStartX.current
    const newWidth = Math.max(180, Math.min(600, resizeStartWidth.current + dx))
    setSidebarWidth(newWidth)
  }
  function handleResizeEnd() {
    setResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // ── Drawing ──────────────────────────────────────────────
  function handleSvgClick(e: React.MouseEvent) {
    // Ignore click that was actually a pan drag
    if (panRef.current.hasMoved) return
    if (drawing) {
      e.stopPropagation()
      setDraftPoints(prev => [...prev, toSvgCoords(e)])
      return
    }

    // Edit mode: insert or deselect
    if (editingRouteId) {
      const tag = (e.target as SVGElement).tagName.toLowerCase()
      const isHandle = tag === 'circle'
      if (isHandle) return
      if (editInsertMode && selectedPointIdx !== null) {
        const pt = toSvgCoords(e)
        setEditPoints(prev => {
          const next = [...prev]
          next.splice(selectedPointIdx + 1, 0, pt)
          return next
        })
        setSelectedPointIdx(prev => prev !== null ? prev + 1 : null)
      } else {
        setSelectedPointIdx(null)
      }
      return
    }
  }

  function handleSvgDblClick(e: React.MouseEvent) {
    if (!drawing) return
    e.stopPropagation()
    const finalPoints = draftPoints.slice(0, -1)
    if (finalPoints.length < 2) return
    finishRoute(finalPoints)
  }

  function handleSvgMouseMove(e: React.MouseEvent) {
    if (drawing) setMousePos(toSvgCoords(e))
  }

  async function finishRoute(points: [number, number][]) {
    const name = prompt('给这条路线起个名字:', `路线 ${routes.length + 1}`)
    if (!name) { cancelDrawing(); return }
    try {
      const route = await api.post<Route>(`/api/maps/${map.id}/routes`, { name, points, color: DEFAULT_COLOR })
      setRoutes(prev => [...prev, { ...route, visible: true }])
    } catch (err) { console.error(err) }
    cancelDrawing()
  }
  function cancelDrawing() { setDrawing(false); setDraftPoints([]); setMousePos(null) }
  function startDrawing() { setDrawing(true); setDraftPoints([]); setSelectedId(null) }

  // ── Edit mode ────────────────────────────────────────────
  function enterEditMode(routeId: string) {
    const route = routes.find(r => r.id === routeId)
    if (!route) return
    setEditingRouteId(routeId)
    setEditPoints([...route.points])
    setSelectedPointIdx(null)
    setEditInsertMode(false)
    draggingIdx.current = null
  }
  function exitEditMode() {
    setEditingRouteId(null)
    setEditPoints([])
    setSelectedPointIdx(null)
    setEditInsertMode(false)
    draggingIdx.current = null
  }
  async function saveEditMode() {
    if (!editingRouteId) return
    await api.put(`/api/maps/${map.id}/routes/${editingRouteId}`, { points: editPoints })
    setRoutes(prev => prev.map(r => r.id === editingRouteId ? { ...r, points: editPoints } : r))
    exitEditMode()
  }
  function deleteEditPoint() {
    if (selectedPointIdx === null || editPoints.length <= 2) return
    const next = editPoints.filter((_, i) => i !== selectedPointIdx)
    setEditPoints(next)
    setSelectedPointIdx(Math.min(selectedPointIdx, next.length - 1))
  }

  // Per-handle pointer drag — called from each circle's onPointerDown
  function handlePointPointerDown(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    e.stopPropagation()
    setSelectedPointIdx(idx)
    if (!editInsertMode) {
      draggingIdx.current = idx
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  function handlePointPointerMove(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    if (draggingIdx.current !== idx) return
    const pt = clientToSvg(e.clientX, e.clientY)
    setEditPoints(prev => prev.map((p, i) => i === idx ? pt : p))
  }
  function handlePointPointerUp(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    if (draggingIdx.current === idx) {
      draggingIdx.current = null
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    }
  }

  // ── Route CRUD ───────────────────────────────────────────
  async function renameRoute(id: string, name: string) {
    await api.put(`/api/maps/${map.id}/routes/${id}`, { name })
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }
  async function recolorRoute(id: string, color: string) {
    await api.put(`/api/maps/${map.id}/routes/${id}`, { color })
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, color } : r))
  }
  async function deleteRoute(id: string) {
    await api.del(`/api/maps/${map.id}/routes/${id}`)
    setRoutes(prev => prev.filter(r => r.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  async function moveRoute(id: string, groupId: string | null) {
    await api.put(`/api/maps/${map.id}/routes/${id}`, { group_id: groupId ?? '' })
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, group_id: groupId } : r))
  }
  async function createGroup(name: string) {
    const group = await api.post<Group>(`/api/maps/${map.id}/groups`, { name })
    setGroups(prev => [...prev, { ...group, visible: true }])
  }
  async function renameGroup(id: string, name: string) {
    await api.put(`/api/maps/${map.id}/groups/${id}`, { name })
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g))
  }
  async function deleteGroup(id: string) {
    await api.del(`/api/maps/${map.id}/groups/${id}`)
    setGroups(prev => prev.filter(g => g.id !== id))
    setRoutes(prev => prev.map(r => r.group_id === id ? { ...r, group_id: null } : r))
  }

  function toggleRouteVisible(id: string) {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, visible: !r.visible } : r))
  }

  function toggleGroupVisible(id: string) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, visible: !g.visible } : g))
  }

  async function handleSetScale(newScale: number) {
    await api.put(`/api/maps/${map.id}`, { scale: newScale })
    setScale(newScale)
  }

  function pointsToString(pts: [number, number][]) {
    return pts.map(([x, y]) => `${x},${y}`).join(' ')
  }

  const previewPoints = mousePos && draftPoints.length > 0 ? [...draftPoints, mousePos] : draftPoints
  const editingRoute = editingRouteId ? routes.find(r => r.id === editingRouteId) ?? null : null

  // Routes visible on map: route visible AND (no group or group visible)
  const visibleRoutes = routes.filter(r =>
    r.visible && (r.group_id === null || groups.find(g => g.id === r.group_id)?.visible)
  )

  const canPanCursor = drawing || !editingRouteId || (selectedPointIdx === null && !editInsertMode)
  const cursor = isPanning ? 'grabbing'
    : (drawing || (editingRouteId && editInsertMode)) ? 'crosshair'
    : canPanCursor ? 'grab' : 'default'

  // Inverse scale factor: keeps stroke/radius/font constant on screen
  const inv = 1 / transform.scale

  return (
    <div className={styles.layout}>
      <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', minWidth: 0 }}>
        <RouteList
          routes={routes}
          groups={groups}
          selectedId={selectedId}
          drawing={drawing}
          scale={scale}
          onSelect={id => { setSelectedId(id); exitEditMode() }}
          onRename={renameRoute}
          onRecolor={recolorRoute}
          onMove={moveRoute}
          onDelete={deleteRoute}
          onCreateGroup={createGroup}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onToggleRouteVisible={toggleRouteVisible}
          onToggleGroupVisible={toggleGroupVisible}
          onStartDraw={startDrawing}
          onCancelDraw={cancelDrawing}
          onSetScale={handleSetScale}
        />
      </div>

      <div
        className={`${styles.resizeHandle} ${resizing ? styles.dragging : ''}`}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
      />

      <div
        className={styles.canvasWrap}
        ref={canvasWrapRef}
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={e => {
          if (drawing || editingRouteId) return
          if ((e.target as HTMLElement).closest('button, input, select')) return
          if (selectedId) setSelectedId(null)
        }}
      >
        <div
          className={styles.imageContainer}
          style={{
            width: map.width,
            height: map.height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            ref={imgRef}
            src={`/uploads/${map.filename}`}
            alt={map.originalName}
            className={styles.mapImage}
            draggable={false}
          />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${map.width} ${map.height}`}
            className={styles.svgOverlay}
            onClick={handleSvgClick}
            onDoubleClick={handleSvgDblClick}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setMousePos(null)}
          >
            {/* Saved routes */}
            {visibleRoutes.map(route => {
              if (route.id === editingRouteId) return null
              return (
                <g key={route.id} onClick={e => {
                  if (!drawing && !editingRouteId && !panRef.current.hasMoved) {
                    e.stopPropagation()
                    setSelectedId(route.id)
                  }
                }}>
                  <polyline
                    points={pointsToString(route.points)}
                    fill="none"
                    stroke={route.color}
                    strokeWidth={(selectedId === route.id ? 5 : 3) * inv}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={editingRouteId ? 0.25 : selectedId && selectedId !== route.id ? 0.4 : 1}
                    className={!drawing && !editingRouteId ? styles.routeLine : ''}
                  />
                  {selectedId === route.id && !editingRouteId && route.points.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={5 * inv} fill={route.color} stroke="#fff" strokeWidth={1.5 * inv} />
                  ))}
                  {selectedId === route.id && !editingRouteId && (() => {
                    const mid = route.points[Math.floor(route.points.length / 2)]
                    if (!mid) return null
                    return (
                      <text x={mid[0]} y={mid[1] - 10 * inv} textAnchor="middle" fontSize={14 * inv}
                        fill={route.color} stroke="#fff" strokeWidth={3 * inv} paintOrder="stroke" fontWeight="600">
                        {route.name}
                      </text>
                    )
                  })()}
                </g>
              )
            })}

            {/* Route being edited */}
            {editingRoute && (
              <g>
                <polyline
                  points={pointsToString(editPoints)}
                  fill="none"
                  stroke={editingRoute.color}
                  strokeWidth={3 * inv}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Insert preview: midpoint dot between selected and next */}
                {editInsertMode && selectedPointIdx !== null && selectedPointIdx < editPoints.length - 1 && (() => {
                  const [x1, y1] = editPoints[selectedPointIdx]
                  const [x2, y2] = editPoints[selectedPointIdx + 1]
                  return (
                    <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2}
                      r={5 * inv} fill="#3182ce" opacity={0.5}
                      style={{ pointerEvents: 'none' }} />
                  )
                })()}
                {/* Route name */}
                {(() => {
                  const mid = editPoints[Math.floor(editPoints.length / 2)]
                  if (!mid) return null
                  return (
                    <text x={mid[0]} y={mid[1] - 14 * inv} textAnchor="middle" fontSize={14 * inv}
                      fill={editingRoute.color} stroke="#fff" strokeWidth={3 * inv}
                      paintOrder="stroke" fontWeight="600" style={{ pointerEvents: 'none' }}>
                      {editingRoute.name}
                    </text>
                  )
                })()}
                {/* Edit handles — pointer events for reliable drag-outside-bounds */}
                {editPoints.map(([x, y], i) => {
                  const isSel = selectedPointIdx === i
                  return (
                    <circle
                      key={i}
                      cx={x} cy={y}
                      r={(isSel ? 10 : 7) * inv}
                      fill={isSel ? '#3182ce' : '#fff'}
                      stroke={isSel ? '#fff' : editingRoute.color}
                      strokeWidth={2.5 * inv}
                      style={{ cursor: editInsertMode ? 'default' : 'move', touchAction: 'none' }}
                      onPointerDown={e => handlePointPointerDown(e, i)}
                      onPointerMove={e => handlePointPointerMove(e, i)}
                      onPointerUp={e => handlePointPointerUp(e, i)}
                      onClick={e => e.stopPropagation()}
                    />
                  )
                })}
              </g>
            )}

            {/* Drawing preview */}
            {drawing && previewPoints.length > 1 && (
              <polyline points={pointsToString(previewPoints)} fill="none"
                stroke={DEFAULT_COLOR} strokeWidth={3 * inv}
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={`${10 * inv} ${6 * inv}`} opacity={0.85} />
            )}
            {drawing && draftPoints.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={5 * inv} fill={DEFAULT_COLOR} stroke="#fff" strokeWidth={1.5 * inv} />
            ))}
          </svg>
        </div>

        {/* Drawing tip */}
        {drawing && (
          <div className={styles.toolbar}>
            单击添加锚点 &nbsp;·&nbsp; 双击完成路线 &nbsp;·&nbsp;
            <button className="btn-ghost" onClick={cancelDrawing}>取消</button>
          </div>
        )}

        {/* Enter edit mode */}
        {selectedId && !drawing && !editingRouteId && (
          <div className={styles.toolbar}>
            <button className="btn-primary" onClick={() => enterEditMode(selectedId)}>
              编辑路线
            </button>
          </div>
        )}

        {/* Edit toolbar */}
        {editingRouteId && (
          <div className={styles.toolbar}>
            <button
              className={editInsertMode ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setEditInsertMode(v => !v)}
            >
              {editInsertMode ? '✦ 插入中' : '插入节点'}
            </button>
            <button
              className="btn-ghost"
              disabled={selectedPointIdx === null || editPoints.length <= 2}
              onClick={deleteEditPoint}
            >
              删除节点
            </button>
            <span className={styles.toolbarDivider} />
            <button className="btn-primary" onClick={saveEditMode}>保存</button>
            <button className="btn-ghost" onClick={exitEditMode}>取消</button>
            <span className={styles.toolbarHint}>
              {editInsertMode
                ? (selectedPointIdx !== null ? '点击地图，在选中节点后插入' : '先点击节点再插入')
                : (selectedPointIdx !== null ? '拖动节点调整位置' : '点击节点选中')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
