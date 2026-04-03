import { useState, useRef } from 'react'
import type { Route, Group } from './MapCanvas'
import styles from './RouteList.module.css'

interface Props {
  routes: Route[]
  groups: Group[]
  selectedId: string | null
  drawing: boolean
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onMove: (id: string, groupId: string | null) => void
  onDelete: (id: string) => void
  onCreateGroup: (name: string) => void
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onStartDraw: () => void
  onCancelDraw: () => void
}

export default function RouteList({
  routes, groups, selectedId, drawing,
  onSelect, onRename, onRecolor, onMove, onDelete,
  onCreateGroup, onRenameGroup, onDeleteGroup,
  onStartDraw, onCancelDraw,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)

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

  function renderRoute(route: Route, indented = false) {
    return (
      <li
        key={route.id}
        className={`${styles.item} ${indented ? styles.indented : ''} ${selectedId === route.id ? styles.selected : ''}`}
        onClick={() => onSelect(route.id)}
      >
        <input
          type="color"
          className={styles.colorPicker}
          value={route.color}
          onClick={e => e.stopPropagation()}
          onChange={e => onRecolor(route.id, e.target.value)}
          title="修改颜色"
        />

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
