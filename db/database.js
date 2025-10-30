const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'oauth_gateway',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    return false;
  }
}

// Initialize database schema
async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, '..', 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found:', schemaPath);
      return false;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by delimiter and execute each statement
    const statements = schema.split(/DELIMITER \$\$|DELIMITER ;/);

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;

      // Split by semicolon for regular statements
      const subStatements = trimmed.split(';').filter(s => s.trim());

      for (const subStatement of subStatements) {
        if (subStatement.trim()) {
          try {
            await pool.query(subStatement);
          } catch (err) {
            // Ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              console.warn('Schema statement warning:', err.message);
            }
          }
        }
      }
    }

    console.log('✓ Database schema initialized');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Query helper with error handling
async function query(text, params = []) {
  const start = Date.now();
  try {
    const [rows] = await pool.execute(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn('Slow query detected:', { text, duration });
    }

    return rows;
  } catch (error) {
    console.error('Database query error:', { text, error: error.message });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Cleanup expired tokens periodically
async function scheduleTokenCleanup() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  setInterval(async () => {
    try {
      await query('CALL cleanup_expired_tokens()');
      console.log('✓ Expired tokens cleaned up');
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }, CLEANUP_INTERVAL);
}

// Graceful shutdown
async function closeDatabase() {
  await pool.end();
  console.log('✓ Database pool closed');
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  initializeDatabase,
  scheduleTokenCleanup,
  closeDatabase
};
