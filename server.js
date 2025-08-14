// server.js — single-row SQLite + REST API
// Accepts: POST / PUT / GET / DELETE / raw download
// Runs anywhere with Node 18+, zero config required
import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- database ----------
const dbFile = path.join(__dirname, 'single.db');
if (!fs.existsSync(dbFile)) {
  const db = new sqlite3.Database(dbFile);
  db.serialize(() => {
    db.run(`
      CREATE TABLE file (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL
      );
    `);
    db.run('INSERT INTO file(id,content) VALUES (1,"")');
  });
  db.close();
}

const db = new sqlite3.Database(dbFile);     // keep open for lifetime
db.serialize(() => {
  db.get('SELECT 1 FROM file WHERE id=1 LIMIT 1', (err,row)=>{
    if(!row){
      db.run('INSERT INTO file(id,content) VALUES (1,"")');
    }
  });
});

// ---------- middleware ----------
app.use(express.text({ limit: '2mb', type: '*/*' }));   // text, json, anything

// ---------- helper promises ----------
const dbGetOne = new Promise((ok,ko)=>{
  db.get('SELECT * FROM file WHERE id = 1', (e,r)=>e?ko(e):ok(r));
});

const dbSet = (txt)=> new Promise((ok,ko)=>{
  db.run('UPDATE file SET content=? WHERE id=1', [txt], e=>e?ko(e):ok());
});

const dbDel = ()=> new Promise((ok,ko)=>{
  db.run('UPDATE file SET content="" WHERE id=1', e=>e?ko(e):ok());
});

// ---------- routes ----------
app.post('/api/file',   async (req,res)=> {
  try{ await dbSet(String(req.body)); res.status(201).json({id:1}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.put('/api/file',    async (req,res)=> {
  try{ await dbSet(String(req.body)); res.json({id:1}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/file',    async (req,res)=> {
  try{
    const row = await dbGetOne;
    if(!row) return res.status(404).json({error:'not found'});
    res.json(row);
  }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/file', async (req,res)=> {
  try{ await dbDel(); res.json({deleted:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/file/raw', async (req,res)=> {
  try{
    const row = await dbGetOne;
    if(!row || row.content === '') return res.status(404).send('Not found');
    res.setHeader('Content-Type','text/plain');
    res.send(row.content);
  }
  catch(e){ res.status(500).send('Server error'); }
});

app.get('/', (_ ,res)=> res.json({status:'up',routes:['/api/file', '/api/file/raw']}));

// ---------- launch ----------
app.listen(PORT, ()=>{
  console.log(`Server listening on ${PORT}`);
});

