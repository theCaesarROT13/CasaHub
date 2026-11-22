const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDB() {
  db = await open({
    filename: './casahub.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      color TEXT,
      points INTEGER DEFAULT 0,
      pin TEXT DEFAULT '1234'
    );
    CREATE TABLE IF NOT EXISTS chores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      room TEXT,
      freqDays INTEGER,
      assigneeId TEXT,
      dueLabel TEXT,
      urgent INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shopping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      addedBy TEXT,
      bought INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      text TEXT,
      author TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const count = await db.get('SELECT COUNT(*) as total FROM users');
  if (count.total === 0) {
    await seedDemoData();
  }
}

async function seedDemoData() {
  await db.exec('DELETE FROM users; DELETE FROM chores; DELETE FROM shopping; DELETE FROM notices; DELETE FROM meta;');

  await db.run(`INSERT INTO users (id, name, color, points, pin) VALUES 
    ('u1', 'Marco', '#4F46E5', 9, '1234'),
    ('u2', 'Giulia', '#0D9488', 11, '1234'),
    ('u3', 'Luca', '#EA580C', 7, '1234'),
    ('u4', 'Sara', '#DB2777', 8, '1234')`);

  await db.run(`INSERT INTO chores (title, room, freqDays, assigneeId, dueLabel, urgent) VALUES 
    ('Pulizia bagno principale', 'Bagno', 7, 'u1', 'Oggi', 1),
    ('Buttare plastica e umido', 'Spazzatura', 3, 'u2', 'Domani', 0),
    ('Pulire piano cottura e lavello', 'Cucina', 2, 'u3', 'Oggi', 1),
    ('Passare aspirapolvere salotto', 'Salotto', 7, 'u4', 'Weekend', 0)`);

  await db.run(`INSERT INTO shopping (name, type, addedBy, bought) VALUES 
    ('Carta igienica (6 rotoli)', 'common', 'Giulia', 0),
    ('Detersivo piatti', 'common', 'Luca', 0),
    ('Latte parzialmente scremato', 'personal', 'Marco', 0)`);

  await db.run(`INSERT INTO notices (icon, text, author) VALUES 
    ('🧺', 'Lavatrice occupata fino alle 18:30', 'Giulia'),
    ('📚', 'Sessione esami: silenzio dopo le 22', 'Marco')`);

  await db.run(`INSERT INTO meta (key, value) VALUES ('requirePin', '0'), ('supermarketAlert', 'null')`);
}

// Stato completo
app.get('/api/state', async (req, res) => {
  const users = await db.all('SELECT * FROM users');
  const chores = await db.all('SELECT * FROM chores');
  const shopping = await db.all('SELECT * FROM shopping');
  const notices = await db.all('SELECT * FROM notices ORDER BY id DESC');
  const pinRow = await db.get("SELECT value FROM meta WHERE key = 'requirePin'");
  const marketRow = await db.get("SELECT value FROM meta WHERE key = 'supermarketAlert'");

  res.json({
    users,
    chores,
    shopping,
    notices,
    requirePin: pinRow ? pinRow.value === '1' : false,
    supermarketAlert: marketRow ? JSON.parse(marketRow.value) : null
  });
});

// Faccende
app.post('/api/chores', async (req, res) => {
  const { title, room, freqDays, assigneeId, dueLabel, urgent } = req.body;
  await db.run(
    'INSERT INTO chores (title, room, freqDays, assigneeId, dueLabel, urgent) VALUES (?, ?, ?, ?, ?, ?)',
    [title, room, freqDays, assigneeId, dueLabel, urgent ? 1 : 0]
  );
  res.json({ ok: true });
});

app.post('/api/chores/:id/complete', async (req, res) => {
  const { userId, nextUserId } = req.body;
  await db.run('UPDATE users SET points = points + 1 WHERE id = ?', [userId]);
  await db.run(
    'UPDATE chores SET assigneeId = ?, dueLabel = "Prossimo turno", urgent = 0 WHERE id = ?',
    [nextUserId, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/chores/:id', async (req, res) => {
  await db.run('DELETE FROM chores WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Spesa
app.post('/api/shopping', async (req, res) => {
  const { name, type, addedBy } = req.body;
  await db.run('INSERT INTO shopping (name, type, addedBy, bought) VALUES (?, ?, ?, 0)', [name, type, addedBy]);
  res.json({ ok: true });
});

app.patch('/api/shopping/:id/toggle', async (req, res) => {
  await db.run('UPDATE shopping SET bought = 1 - bought WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/shopping/bought', async (req, res) => {
  await db.run('DELETE FROM shopping WHERE bought = 1');
  res.json({ ok: true });
});

// Bacheca Avvisi
app.post('/api/notices', async (req, res) => {
  const { icon, text, author } = req.body;
  await db.run('INSERT INTO notices (icon, text, author) VALUES (?, ?, ?)', [icon, text, author]);
  res.json({ ok: true });
});

app.delete('/api/notices/:id', async (req, res) => {
  await db.run('DELETE FROM notices WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Banner Supermercato
app.post('/api/supermarket', async (req, res) => {
  await db.run(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('supermarketAlert', ?)",
    [JSON.stringify(req.body)]
  );
  res.json({ ok: true });
});

// Impostazione PIN & Coinquilini
app.post('/api/settings/pin', async (req, res) => {
  await db.run(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('requirePin', ?)",
    [req.body.requirePin ? '1' : '0']
  );
  res.json({ ok: true });
});

app.post('/api/users', async (req, res) => {
  const { name, color, pin } = req.body;
  const id = 'u' + Date.now();
  await db.run('INSERT INTO users (id, name, color, points, pin) VALUES (?, ?, ?, 0, ?)', [id, name, color, pin]);
  res.json({ ok: true });
});

app.delete('/api/users/:id', async (req, res) => {
  const fallback = await db.get('SELECT id FROM users WHERE id != ? LIMIT 1', [req.params.id]);
  if (fallback) {
    await db.run('UPDATE chores SET assigneeId = ? WHERE assigneeId = ?', [fallback.id, req.params.id]);
  }
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Reset dati demo
app.post('/api/reset', async (req, res) => {
  await seedDemoData();
  res.json({ ok: true });
});

initDB().then(() => {
  app.listen(3000, '0.0.0.0', () => {
    console.log('✅ CasaHub attivo su http://localhost:3000');
  });
});
