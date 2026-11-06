// BookNook — a tiny full-stack bookshop that is vulnerable ON PURPOSE.
// Every flaw is labelled [FLAGGED] or [NOT FLAGGED] by whether DevDeploy's
// scanners are expected to catch it — see README.md. Never expose this.
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const _ = require('lodash');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Serve the (old) jQuery straight from node_modules so the frontend uses it.
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

async function initDb() {
  await sequelize.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, password TEXT, role TEXT)');
  await sequelize.query('CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT, price REAL)');
  await sequelize.query('CREATE TABLE reviews (id INTEGER PRIMARY KEY, book_id INTEGER, author TEXT, body TEXT)');
  await sequelize.query('CREATE TABLE orders (id INTEGER PRIMARY KEY, owner TEXT, book_id INTEGER, address TEXT)');

  // Plaintext passwords in the DB.                                [NOT FLAGGED]
  await sequelize.query("INSERT INTO users (name, password, role) VALUES ('admin', 'admin123', 'admin'), ('alice', 'wonderland', 'user')");
  await sequelize.query("INSERT INTO books (title, author, price) VALUES ('Dune', 'Frank Herbert', 9.99), ('Neuromancer', 'William Gibson', 8.5), ('Hyperion', 'Dan Simmons', 11.0)");
  await sequelize.query("INSERT INTO orders (owner, book_id, address) VALUES ('admin', 1, '1 Admin Way'), ('alice', 2, '42 Rabbit Hole')");
}

// 1. SQL injection — search term concatenated into the query.      [FLAGGED]
//    Try: /api/books/search?q=' UNION SELECT id,name,password,0 FROM users--
app.get('/api/books/search', async (req, res) => {
  const [rows] = await sequelize.query(
    "SELECT id, title, author, price FROM books WHERE title LIKE '%" + req.query.q + "%'"
  );
  res.json(rows);
});

// 2. SQL injection — classic login bypass.                         [FLAGGED]
//    Try name = admin'--   (password ignored)
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  const [rows] = await sequelize.query(
    `SELECT id, name, role FROM users WHERE name = '${name}' AND password = '${password}'`
  );
  if (rows.length === 0) return res.status(401).json({ error: 'bad credentials' });
  // "Token" is just base64 of the username — trivially forgeable.   [NOT FLAGGED]
  res.json({ token: Buffer.from(rows[0].name).toString('base64'), user: rows[0] });
});

// Reviews are stored with parameterised queries (safe on the way in)...
app.post('/api/reviews', async (req, res) => {
  const { book_id, author, body } = req.body;
  await sequelize.query('INSERT INTO reviews (book_id, author, body) VALUES (?, ?, ?)', {
    replacements: [book_id, author, body],
  });
  res.status(201).json({ ok: true });
});

app.get('/api/reviews', async (req, res) => {
  const [rows] = await sequelize.query('SELECT * FROM reviews WHERE book_id = ?', {
    replacements: [req.query.book_id],
  });
  res.json(rows);
});

// 3. Second-order SQL injection: the value is read back from the DB (not from
//    the request) and then concatenated. A scanner that only follows data from
//    req.* never sees it — a real-world blind spot.                [NOT FLAGGED]
//    Post a review with author = x' OR '1'='1 , then GET this with its id.
app.get('/api/reviews/:id/by-same-author', async (req, res) => {
  const [[review]] = await sequelize.query('SELECT author FROM reviews WHERE id = ?', {
    replacements: [req.params.id],
  });
  if (!review) return res.status(404).json({ error: 'not found' });
  const [rows] = await sequelize.query("SELECT * FROM reviews WHERE author = '" + review.author + "'");
  res.json(rows);
});

// 4. Reflected XSS — user input echoed into HTML.                   [FLAGGED]
app.get('/greet', (req, res) => {
  res.send('<h1>Welcome back, ' + req.query.name + '!</h1>');
});

// 5. Path traversal — try /download?file=../index.js                [FLAGGED]
app.get('/download', (req, res) => {
  res.sendFile(path.join(__dirname, 'files', req.query.file));
});

// 6. Open redirect.                                                 [FLAGGED]
app.get('/go', (req, res) => {
  res.redirect(req.query.url);
});

// 7. Command injection — try /api/ping?host=127.0.0.1;id            [FLAGGED]
app.get('/api/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.host, (err, stdout) => res.send(stdout));
});

// 8. SSRF — server fetches any URL the caller supplies.             [NOT FLAGGED]
app.get('/api/preview', async (req, res) => {
  const r = await fetch(req.query.url);
  res.send(await r.text());
});

// 9. Broken access control (IDOR) — any caller can read any order,
//    no check that it belongs to them. Pure business logic.         [NOT FLAGGED]
app.get('/api/orders/:id', async (req, res) => {
  const [[order]] = await sequelize.query('SELECT * FROM orders WHERE id = ?', {
    replacements: [req.params.id],
  });
  res.json(order || {});
});

// 10. Prototype pollution via lodash merge of untrusted JSON. The pattern
//     itself isn't flagged, but the lodash version has known CVEs, which
//     Trivy reports (and, being a direct dependency, marks reachable).
app.post('/api/settings', (req, res) => {
  const settings = _.merge({ theme: 'light' }, req.body);
  res.json(settings);
});

app.get('/health', (req, res) => res.json({ healthy: true }));

initDb().then(() => {
  app.listen(PORT, () => console.log(`BookNook listening on port ${PORT}`));
});
