import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mapsRouter from './routes/maps.js';
import routesRouter from './routes/routes.js';
import groupsRouter from './routes/groups.js';
import authRouter from './routes/auth.js';
import { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/maps/:mapId/routes', routesRouter);
app.use('/api/maps/:mapId/groups', groupsRouter);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`CityWalk server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
