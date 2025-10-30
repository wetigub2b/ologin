#!/usr/bin/env node

/**
 * OAuth Gateway Setup Script
 *
 * This script helps you:
 * 1. Create a MySQL database
 * 2. Initialize the schema
 * 3. Create your first OAuth client
 */

require('dotenv').config();
const readline = require('readline');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateRandomKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   OAuth Gateway Setup Wizard           ║');
  console.log('╚════════════════════════════════════════╝\n');

  let connection = null;
  let db = null;
  let models = null;

  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    };

    const dbName = process.env.DB_NAME || 'oauth_gateway';
    const targetUser = process.env.DB_USER || 'root';
    const targetPassword = process.env.DB_PASSWORD || '';

    // Step 1: Connect to MySQL server (without database)
    console.log('📊 Step 1: Connecting to MySQL server...');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   User: ${dbConfig.user}`);

    let usingSudo = false;

    try {
      connection = await mysql.createConnection(dbConfig);
      console.log('✓ Connected to MySQL server\n');
    } catch (error) {
      // If connection failed, try using sudo mysql
      if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ECONNREFUSED') {
        console.log(`⚠️  Cannot connect with user '${dbConfig.user}'`);
        console.log('   Attempting to use sudo mysql...\n');

        try {
          // Test if sudo mysql works
          await execPromise('sudo mysql -e "SELECT 1" > /dev/null 2>&1');
          console.log('✓ sudo mysql is available\n');
          usingSudo = true;

          // We'll use sudo mysql for setup, then connect normally after
        } catch (sudoError) {
          console.log('\n❌ Cannot use sudo mysql!');
          console.log('\nError:', error.message);
          console.log('\nPlease ensure:');
          console.log('  1. MySQL server is running: sudo systemctl status mysql');
          console.log('  2. You have sudo privileges');
          console.log('  3. MySQL root user exists');
          console.log('\nAlternatively, set correct DB_USER and DB_PASSWORD in .env');
          process.exit(1);
        }
      } else {
        console.log('\n❌ MySQL connection failed!');
        console.log('\nError:', error.message);
        console.log('\nPlease check:');
        console.log('  1. MySQL server is running: sudo systemctl status mysql');
        console.log('  2. Credentials in .env file are correct:');
        console.log('     DB_HOST=' + dbConfig.host);
        console.log('     DB_PORT=' + dbConfig.port);
        console.log('     DB_USER=' + dbConfig.user);
        console.log('     DB_PASSWORD=' + (process.env.DB_PASSWORD ? '***' : '(not set)'));
        process.exit(1);
      }
    }

    // Step 2: Check and create MySQL user if needed
    console.log('👤 Step 2: Checking MySQL user...');

    try {
      // Check if target user exists (only if not root)
      if (targetUser !== 'root') {
        let userExists = false;

        if (usingSudo) {
          // Check user via sudo mysql
          try {
            const { stdout } = await execPromise(
              `sudo mysql -e "SELECT User FROM mysql.user WHERE User='${targetUser}';" -N`
            );
            userExists = stdout.trim().length > 0;
          } catch (e) {
            userExists = false;
          }
        } else {
          const [users] = await connection.query(
            "SELECT User FROM mysql.user WHERE User = ?",
            [targetUser]
          );
          userExists = users.length > 0;
        }

        if (!userExists) {
          console.log(`   User '${targetUser}' does not exist. Creating...`);

          if (!targetPassword) {
            console.log('\n❌ DB_PASSWORD is required to create new user!');
            console.log('   Please set DB_PASSWORD in your .env file');
            process.exit(1);
          }

          if (usingSudo) {
            // Create user via sudo mysql
            await execPromise(
              `sudo mysql -e "CREATE USER '${targetUser}'@'${dbConfig.host}' IDENTIFIED BY '${targetPassword}';"`
            );
          } else {
            // Create user via connection
            await connection.query(
              `CREATE USER '${targetUser}'@'${dbConfig.host}' IDENTIFIED BY '${targetPassword}'`
            );
          }

          console.log(`✓ User '${targetUser}' created successfully`);
        } else {
          console.log(`✓ User '${targetUser}' already exists`);
        }

        // Grant privileges (whether user is new or existing)
        console.log('   Granting privileges...');

        if (usingSudo) {
          // Grant via sudo mysql
          await execPromise(
            `sudo mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${targetUser}'@'${dbConfig.host}';"`
          );
          await execPromise(
            `sudo mysql -e "GRANT CREATE ON *.* TO '${targetUser}'@'${dbConfig.host}';"`
          );
          await execPromise('sudo mysql -e "FLUSH PRIVILEGES;"');
        } else {
          await connection.query(
            `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${targetUser}'@'${dbConfig.host}'`
          );
          await connection.query(
            `GRANT CREATE ON *.* TO '${targetUser}'@'${dbConfig.host}'`
          );
          await connection.query('FLUSH PRIVILEGES');
        }

        console.log(`✓ Privileges granted to '${targetUser}'`);
      } else {
        console.log(`✓ Using root user (full privileges)`);
      }
    } catch (error) {
      console.log('\n⚠️  User setup warning:', error.message);
      console.log('   Continuing with setup...\n');
    }

    console.log();

    // Step 3: Create database if it doesn't exist
    console.log('🗄️  Step 3: Checking database...');

    try {
      let dbExists = false;

      if (usingSudo) {
        // Check database via sudo mysql
        try {
          const { stdout } = await execPromise(
            `sudo mysql -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='${dbName}';" -N`
          );
          dbExists = stdout.trim().length > 0;
        } catch (e) {
          dbExists = false;
        }
      } else {
        const [databases] = await connection.query(
          'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
          [dbName]
        );
        dbExists = databases.length > 0;
      }

      if (!dbExists) {
        console.log(`   Database '${dbName}' does not exist. Creating...`);

        if (usingSudo) {
          await execPromise(
            `sudo mysql -e "CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`
          );
        } else {
          await connection.query(
            `CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
          );
        }

        console.log(`✓ Database '${dbName}' created successfully`);
      } else {
        console.log(`✓ Database '${dbName}' already exists`);
      }
    } catch (error) {
      console.log('\n❌ Failed to create database!');
      console.log('Error:', error.message);
      console.log('\nTry running: sudo mysql -e "CREATE DATABASE ${dbName};"');
      process.exit(1);
    }

    // Close connection to MySQL server if it was opened
    if (connection) {
      await connection.end();
    }
    console.log();

    // Step 4: Connect to the database and initialize schema
    console.log('📋 Step 4: Initializing database schema...');

    // Now load the db module which will connect to the specific database
    db = require('./db/database');
    models = require('./db/models');

    const connected = await db.testConnection();
    if (!connected) {
      console.log('\n❌ Could not connect to database!');
      process.exit(1);
    }

    await db.initializeDatabase();
    console.log('✓ Database schema initialized\n');

    // Step 5: Check environment variables
    console.log('🔐 Step 5: Checking environment configuration...');

    const warnings = [];

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this')) {
      warnings.push('JWT_SECRET needs to be set to a secure random value');
    }

    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this')) {
      warnings.push('SESSION_SECRET needs to be set to a secure random value');
    }

    if (!process.env.ADMIN_API_KEY || process.env.ADMIN_API_KEY.includes('change-this')) {
      warnings.push('ADMIN_API_KEY needs to be set to a secure random value');
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Security warnings:');
      warnings.forEach(w => console.log('   - ' + w));
      console.log('\nRecommended values:');
      console.log('  JWT_SECRET=' + generateRandomKey());
      console.log('  SESSION_SECRET=' + generateRandomKey());
      console.log('  ADMIN_API_KEY=' + generateRandomKey(16));
      console.log('\nAdd these to your .env file before running in production!\n');

      const continueSetup = await question('Continue anyway? (y/n): ');
      if (continueSetup.toLowerCase() !== 'y') {
        console.log('\nSetup cancelled. Please update your .env file and run again.');
        process.exit(0);
      }
    } else {
      console.log('✓ Security configuration looks good\n');
    }

    // Step 6: Create first OAuth client
    console.log('📱 Step 6: Create your first OAuth client\n');

    const createClient = await question('Would you like to create an OAuth client now? (y/n): ');

    if (createClient.toLowerCase() === 'y') {
      console.log('\n--- Client Information ---\n');

      const clientName = await question('Client name (e.g., "My App"): ');
      const clientDescription = await question('Description (optional): ');
      const redirectUri = await question('Redirect URI (e.g., "http://localhost:4000/callback"): ');

      console.log('\n🔧 Creating client...');

      const client = await models.createClient({
        name: clientName || 'My Application',
        description: clientDescription || null,
        redirectUris: [redirectUri || 'http://localhost:4000/callback'],
        allowedScopes: ['openid', 'profile', 'email'],
        isConfidential: true
      });

      console.log('\n✅ Client created successfully!\n');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('CLIENT CREDENTIALS (save these securely!)');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Client ID:     ' + client.client_id);
      console.log('Client Secret: ' + client.plainSecret);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('\n⚠️  IMPORTANT: The client secret will not be shown again!');
      console.log('    Save it in a secure location (e.g., password manager)\n');
    }

    // Step 7: Summary
    console.log('\n✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Visit: http://localhost:' + (process.env.PORT || 3000));
    console.log('3. Read GATEWAY.md for integration guide\n');

    console.log('OAuth Endpoints:');
    console.log('  - Authorization: /oauth/authorize');
    console.log('  - Token:         /oauth/token');
    console.log('  - UserInfo:      /api/userinfo\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // Already closed
      }
    }
    if (db && db.closeDatabase) {
      await db.closeDatabase();
    }
    rl.close();
  }
}

main();
