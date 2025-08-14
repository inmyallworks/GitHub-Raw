// server.js — single-row SQLite + REST API
// Accepts: POST / PUT / GET / DELETE / raw download
// Runs anywhere with Node 18+, zero config required

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- database ----------
const dbFile = '/app/single.db'; // Use absolute path for Render volume

// Ensure database file exists and is initialized
const initDB = async () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('Failed to connect to database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS file (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            content TEXT NOT NULL
          );
        `);

        db.get('SELECT 1 FROM file WHERE id=1 LIMIT 1', (err, row) => {
          if (err) {
            console.error('Database query failed:', err);
            reject(err);
            return;
          }
          if (!row) {
            db.run('INSERT INTO file(id,content) VALUES (1,"")', (err) => {
              if (err) {
                console.error('Failed to insert default row:', err);
                reject(err);
                return;
              }
              console.log('Inserted default row');
            });
          }
          resolve();
        });
      });
    });
  });
};

// Initialize database and create connection
let db;
try {
  db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
      console.error('Failed to connect to database:', err);
      process.exit(1); // Exit if DB fails
    }
  });
} catch (err) {
  console.error('Critical error initializing database:', err);
  process.exit(1);
}

// Wait for DB initialization
initDB().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// ---------- middleware ----------
app.use(express.text({ limit: '2mb', type: '*/*' })); // Accept text/json

// ---------- helper functions ----------
const dbGetOne = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM file WHERE id = 1', (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbSet = (txt) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE file SET content=? WHERE id=1', [txt], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const dbDel = () => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE file SET content="" WHERE id=1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// ---------- routes ----------
app.post('/api/file', async (req, res) => {
  try {
    await dbSet(String(req.body));
    res.status(201).json({ id: 1 });
  } catch (e) {
    console.error('POST error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/file', async (req, res) => {
  try {
    await dbSet(String(req.body));
    res.json({ id: 1 });
  } catch (e) {
    console.error('PUT error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const row = await dbGetOne();
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (e) {
    console.error('GET error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/file', async (req, res) => {
  try {
    await dbDel();
    res.json({ deleted: true });
  } catch (e) {
    console.error('DELETE error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/file/raw', async (req, res) => {
  try {
    const row = await dbGetOne();
    if (!row || row.content === '') return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/plain');
    res.send(row.content);
  } catch (e) {
    console.error('RAW error:', e);
    res.status(500).send('Server error');
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'up', routes: ['/api/file', '/api/file/raw'] });
});

// ---------- launch ----------
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
