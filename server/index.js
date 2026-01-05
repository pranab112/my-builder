import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'proshot-secret-key-change-in-production';

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors({
  origin: true, // Allow all origins (same-origin requests in production)
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Initialize database tables
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping database init');
    return;
  }

  let retries = 5;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            avatar VARCHAR(500),
            provider VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            data JSONB,
            thumbnail TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
          CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
        `);
        console.log('✅ Database initialized');
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      retries--;
      console.error(`Database connection failed, ${retries} retries left:`, err.message);
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds before retry
      }
    }
  }
  console.error('❌ Could not connect to database after retries');
}

// Auth middleware
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, avatar) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar',
      [name, email, hashedPassword, avatar]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.password_hash && password) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, avatar FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PROJECT ROUTES ====================

// Get all projects for user
app.get('/api/projects', authMiddleware, async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT * FROM projects WHERE user_id = $1';
    const params = [req.user.id];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }
    query += ' ORDER BY updated_at DESC';

    const result = await pool.query(query, params);

    // Transform to match frontend format
    const projects = result.rows.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      description: p.description,
      data: p.data,
      thumbnail: p.thumbnail,
      createdAt: new Date(p.created_at).getTime(),
      updatedAt: new Date(p.updated_at).getTime(),
      userId: p.user_id
    }));

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const p = result.rows[0];
    res.json({
      id: p.id,
      type: p.type,
      name: p.name,
      description: p.description,
      data: p.data,
      thumbnail: p.thumbnail,
      createdAt: new Date(p.created_at).getTime(),
      updatedAt: new Date(p.updated_at).getTime(),
      userId: p.user_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update project
app.post('/api/projects', authMiddleware, async (req, res) => {
  const { id, type, name, description, data, thumbnail } = req.body;
  try {
    let result;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Safely stringify data
    const dataJson = data ? JSON.stringify(data) : null;

    if (id) {
      // Check if project exists first
      const existing = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (existing.rows.length > 0) {
        // Update existing
        result = await pool.query(
          `UPDATE projects SET name = $1, description = $2, data = $3, thumbnail = $4, updated_at = CURRENT_TIMESTAMP
           WHERE id = $5 AND user_id = $6 RETURNING *`,
          [name, description, dataJson, thumbnail, id, req.user.id]
        );
      } else {
        // Project doesn't exist, create with provided ID
        result = await pool.query(
          `INSERT INTO projects (id, user_id, type, name, description, data, thumbnail)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [id, req.user.id, type, name, description, dataJson, thumbnail]
        );
      }
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO projects (user_id, type, name, description, data, thumbnail)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.user.id, type, name, description, dataJson, thumbnail]
      );
    }

    const p = result.rows[0];
    if (!p) {
      return res.status(500).json({ error: 'Failed to save project' });
    }

    res.json({
      id: p.id,
      type: p.type,
      name: p.name,
      description: p.description,
      data: p.data,
      thumbnail: p.thumbnail,
      createdAt: new Date(p.created_at).getTime(),
      updatedAt: new Date(p.updated_at).getTime(),
      userId: p.user_id
    });
  } catch (err) {
    console.error('Save project error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete project
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI ROUTES ====================

// Rate limiting for AI
let lastAIRequest = 0;
const AI_RATE_LIMIT = 2000; // 2 seconds between requests

app.post('/api/ai/generate', authMiddleware, async (req, res) => {
  const now = Date.now();
  if (now - lastAIRequest < AI_RATE_LIMIT) {
    return res.status(429).json({ error: 'Rate limited. Please wait.' });
  }
  lastAIRequest = now;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI API key not configured' });
    }

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent(req.body);

    res.json({
      text: response.text,
      candidates: response.candidates
    });
  } catch (err) {
    console.error('AI Error:', err);
    res.status(500).json({ error: err.message || 'AI service error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database URL: ${process.env.DATABASE_URL ? 'configured' : 'not set'}`);

  // Initialize DB in background (don't block startup)
  initDB().catch(err => {
    console.error('Background DB init failed:', err.message);
  });
});
