# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Server (Node.js + Express)
```bash
cd server && npm run dev    # start with --watch on port 3001
cd server && npm start      # production start
```

### Client (React + Vite)
```bash
cd client && npm run dev    # Vite dev server on port 5173 (proxies /api and /uploads to :3001)
cd client && npm run build  # TypeScript check + Vite build
```

Both must run together for full functionality.

## Architecture

### Overview
- **client/** — React + TypeScript frontend (Vite, CSS Modules)
- **server/** — Node.js + Express backend (ESM, no TypeScript)
- **server/uploads/** — uploaded map images stored on disk
- **server/citywalk.db** — SQLite database (auto-created on first run)

### Data flow
1. User uploads map image → `POST /api/maps` (multer → disk, sharp reads dimensions) → returns `{id, width, height, filename}`
2. Frontend renders `<MapCanvas>` with `<img>` + absolutely-positioned `<svg>` overlay
3. SVG `viewBox="0 0 {width} {height}"` = pixel coordinate system matching original image
4. Click to add polyline anchor points; double-click to finish route, enters name via `prompt()`
5. Route saved to backend: `POST /api/maps/:mapId/routes` with `{name, points: [[x,y],...], color}`
6. On reload, routes are fetched from `GET /api/maps/:mapId/routes` and re-rendered as `<polyline>` elements

### Key files
- `server/index.js` — Express entry point, static `/uploads` serving
- `server/db.js` — SQLite init (maps + routes tables)
- `server/routes/maps.js` — map upload + metadata endpoint
- `server/routes/routes.js` — route CRUD endpoints
- `client/src/components/MapCanvas.tsx` — SVG drawing engine, coordinate mapping, state
- `client/src/components/RouteList.tsx` — sidebar with rename/delete UI
- `client/src/components/UploadMap.tsx` — drag-and-drop image uploader

### Coordinate system
Points are stored in **original image pixel coordinates** (not scaled/normalized). The SVG `viewBox` matches the image's natural pixel dimensions, so coordinates remain valid regardless of how the browser scales the display.

### API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/maps` | Upload image (multipart `image` field) |
| GET | `/api/maps/:id` | Map metadata |
| GET | `/api/maps/:id/routes` | All routes for a map |
| POST | `/api/maps/:id/routes` | Create route `{name, points, color}` |
| PUT | `/api/maps/:id/routes/:routeId` | Update `{name?, color?}` |
| DELETE | `/api/maps/:id/routes/:routeId` | Delete route |
