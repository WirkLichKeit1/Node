import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createDb() {
  // Abre o banco existente meubanco.db (não apaga nada)
  const db = await open({
    filename: path.join(__dirname, 'meubanco.db'),
    driver: sqlite3.Database
  });

  // Cria tabela de mensagens se não existir
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

const app = express();
app.use(express.json());

// Arquivos estáticos (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint raiz → serve o arquivo.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'arquivo.html'));
});

let db;
createDb().then((d) => {
  db = d;
  console.log('Banco conectado: meubanco.db');
}).catch((err) => {
  console.error('Erro ao abrir o banco:', err);
  process.exit(1);
});

/**
 * GET /api/users/:id
 * Busca usuário por ID em uma tabela "users"
 * Espera-se que exista uma tabela users com colunas: id (INTEGER), name (TEXT) ou similar.
 * Caso seu schema seja diferente, ajuste a query.
 */
app.get('/api/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    // Tenta achar um nome em 'name' ou 'nome'
    // Se seu schema usar outra coluna, ajuste aqui.
    const user = await db.get(`
      SELECT id, name
      FROM users
      WHERE id = ?
    `, [id]);

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

/**
 * GET /api/messages
 * Lista mensagens entre dois usuários (userId e peerId)
 * Ex: /api/messages?userId=1&peerId=2
 */
app.get('/api/messages', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const peerId = Number(req.query.peerId);
    if (!Number.isInteger(userId) || !Number.isInteger(peerId)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const rows = await db.all(`
      SELECT id, from_id, to_id, content, datetime(created_at) as created_at
      FROM messages
      WHERE (from_id = ? AND to_id = ?)
         OR (from_id = ? AND to_id = ?)
      ORDER BY id ASC
    `, [userId, peerId, peerId, userId]);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

/**
 * POST /api/messages
 * Envia uma mensagem: { from_id, to_id, content }
 */
app.post('/api/messages', async (req, res) => {
  try {
    const { from_id, to_id, content } = req.body;
    if (!Number.isInteger(from_id) || !Number.isInteger(to_id) || !content?.trim()) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const result = await db.run(`
      INSERT INTO messages (from_id, to_id, content) VALUES (?, ?, ?)
    `, [from_id, to_id, content.trim()]);

    const saved = await db.get(`
      SELECT id, from_id, to_id, content, datetime(created_at) as created_at
      FROM messages
      WHERE id = ?
    `, [result.lastID]);

    res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, senha } = req.body;
    if (!name || !email || !senha) {
      return res.status(400).json({ error: 'Dados inválidos'});
    }

    const result = await db.run(`
      INSERT INTO users (name, email, senha)
      VALUES
      (?, ?, ?)
    `, [name, email, senha]);

    const saved = await db.run(`
      SELECT name, email, senha
      FROM users
      WHERE id = ?
    `, [result.lastID]);

    res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.'});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
