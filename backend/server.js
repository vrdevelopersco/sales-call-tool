const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://anakin0:dejameacuerdo@localhost:5432/sales_call_db'
});

// Set timezone for the connection
pool.on('connect', async (client) => {
  try {
    // Set timezone to Colombia (UTC-5) 
    await client.query("SET timezone = 'America/Bogota'");
    console.log('🌍 Database timezone set to America/Bogota (UTC-5)');
  } catch (err) {
    console.error('Error setting timezone:', err);
  }
});

// Middleware - Allow all origins for development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ================================
// AUTH ROUTES
// ================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1', 
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check password (supporting both plain text and bcrypt)
    let isValidPassword = false;
    
    if (user.password_hash.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else {
    isValidPassword = password === user.password_hash;
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================================
// USER MANAGEMENT ROUTES
// ================================

// Get current user details (for profile)
app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (Admin only)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = password; // Plain text for development
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, passwordHash, role || 'agent']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;
    
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    let query = 'UPDATE users SET username = $1';
    let params = [username];
    let paramCount = 1;
    
    if (password) {
      paramCount++;
      const passwordHash = password;
      query += `, password_hash = $${paramCount}`;
      params.push(passwordHash);
    }
    
    if (role && req.user.role === 'admin') {
      paramCount++;
      query += `, role = $${paramCount}`;
      params.push(role);
    }
    
    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING id, username, role`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// ================================
// CALL RECORDS ROUTES
// ================================

// --- ESTA ES LA SECCIÓN CORREGIDA ---
// Get call records (all for admin, own for agent)
app.get('/api/records', authenticateToken, async (req, res) => {
  try {
    let queryText;
    let queryParams = [];

    if (req.user.role === 'admin') {
      // Admin gets all records for the stats page
      console.log('👑 Admin access: fetching all records.');
      queryText = 'SELECT * FROM call_records ORDER BY created_at DESC';
    } else {
      // Agent gets only their own records
      console.log(`👤 Agent (ID: ${req.user.id}) access: fetching own records.`);
      queryText = 'SELECT * FROM call_records WHERE user_id = $1 ORDER BY created_at DESC';
      queryParams.push(req.user.id);
    }
    
    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create call record
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const {
      firstName, lastName, principalPhone, alternativePhone,
      email, address, saleType, saleId1, saleId2,
      saleCompleted, callbackRequired, callbackDateTime,
      saleDate, notes
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO call_records (
        user_id, first_name, last_name, principal_phone, alternative_phone,
        email, address, sale_type, sale_id_1, sale_id_2,
        sale_completed, callback_required, callback_datetime,
        sale_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        req.user.id, firstName, lastName, principalPhone, alternativePhone,
        email, address, saleType, saleId1, saleId2,
        saleCompleted, callbackRequired, callbackDateTime || null,
        saleDate, notes
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update call record
app.put('/api/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, principalPhone, alternativePhone,
      email, address, saleType, saleId1, saleId2,
      saleCompleted, callbackRequired, callbackDateTime,
      saleDate, notes
    } = req.body;
    
    const result = await pool.query(
      `UPDATE call_records SET
        first_name = $1, last_name = $2, principal_phone = $3, alternative_phone = $4,
        email = $5, address = $6, sale_type = $7, sale_id_1 = $8, sale_id_2 = $9,
        sale_completed = $10, callback_required = $11, callback_datetime = $12,
        sale_date = $13, notes = $14
      WHERE id = $15 AND user_id = $16
      RETURNING *`,
      [
        firstName, lastName, principalPhone, alternativePhone,
        email, address, saleType, saleId1, saleId2,
        saleCompleted, callbackRequired, callbackDateTime || null,
        saleDate, notes, id, req.user.id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found or permission denied' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update record error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete call record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM call_records WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found or permission denied' });
    }
    
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================================
// HEALTH CHECK
// ================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: 'Disconnected' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sales Call API server running on port ${PORT}`);
});

