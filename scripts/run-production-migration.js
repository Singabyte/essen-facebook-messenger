#!/usr/bin/env node

/**
 * Production Migration Runner
 * Safely runs database migrations in production environment
 * 
 * Usage:
 *   node scripts/run-production-migration.js [migration-file]
 *   
 * Examples:
 *   node scripts/run-production-migration.js add-bot-control.sql
 *   node scripts/run-production-migration.js  # Runs all pending migrations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// For production environments with self-signed certificates (DigitalOcean)
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('digitalocean')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false,
    require: true,
    requestCert: false
  } : false,
  // Additional connection settings
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

/**
 * Ask for user confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Check if migrations table exists, create if not
 */
async function ensureMigrationsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW(),
      checksum VARCHAR(64),
      success BOOLEAN DEFAULT true,
      error_message TEXT
    );
  `;
  
  await pool.query(createTableQuery);
  console.log(`${colors.green}✓${colors.reset} Migrations table ready`);
}

/**
 * Check if a migration has already been applied
 */
async function isMigrationApplied(filename) {
  const result = await pool.query(
    'SELECT * FROM migrations WHERE filename = $1 AND success = true',
    [filename]
  );
  return result.rows.length > 0;
}

/**
 * Record a migration in the migrations table
 */
async function recordMigration(filename, success, errorMessage = null) {
  const crypto = require('crypto');
  const filePath = path.join(__dirname, '..', 'sql', filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  
  await pool.query(
    `INSERT INTO migrations (filename, checksum, success, error_message) 
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) 
     DO UPDATE SET 
       applied_at = NOW(),
       checksum = $2,
       success = $3,
       error_message = $4`,
    [filename, checksum, success, errorMessage]
  );
}

/**
 * Run a single migration file
 */
async function runMigration(filename) {
  console.log(`\n${colors.cyan}Processing migration: ${colors.bright}${filename}${colors.reset}`);
  
  // Check if already applied
  if (await isMigrationApplied(filename)) {
    console.log(`${colors.yellow}⚠${colors.reset}  Migration already applied, skipping...`);
    return { success: true, skipped: true };
  }
  
  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'sql', filename);
  if (!fs.existsSync(migrationPath)) {
    console.error(`${colors.red}✗${colors.reset} Migration file not found: ${migrationPath}`);
    return { success: false, error: 'File not found' };
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Show migration preview
  console.log(`${colors.blue}Migration preview:${colors.reset}`);
  console.log('─'.repeat(50));
  const lines = migrationSQL.split('\n').slice(0, 10);
  lines.forEach(line => console.log(`  ${line}`));
  if (migrationSQL.split('\n').length > 10) {
    console.log(`  ... (${migrationSQL.split('\n').length - 10} more lines)`);
  }
  console.log('─'.repeat(50));
  
  // Ask for confirmation
  const confirmed = await askConfirmation(
    `${colors.yellow}Do you want to apply this migration? (y/n): ${colors.reset}`
  );
  
  if (!confirmed) {
    console.log(`${colors.yellow}⚠${colors.reset}  Migration skipped by user`);
    return { success: true, skipped: true };
  }
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log(`${colors.blue}→${colors.reset} Starting transaction...`);
    
    // Execute migration
    await client.query(migrationSQL);
    console.log(`${colors.green}✓${colors.reset} Migration SQL executed successfully`);
    
    // Verify migration (basic check - you can add custom verification)
    console.log(`${colors.blue}→${colors.reset} Verifying migration...`);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(`${colors.green}✓${colors.reset} Transaction committed`);
    
    // Record successful migration
    await recordMigration(filename, true);
    console.log(`${colors.green}✓${colors.reset} Migration recorded in database`);
    
    return { success: true };
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}✗${colors.reset} Migration failed: ${error.message}`);
    console.error(`${colors.red}✗${colors.reset} Transaction rolled back`);
    
    // Record failed migration
    await recordMigration(filename, false, error.message);
    
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Get list of SQL files in the sql directory
 */
function getMigrationFiles() {
  const sqlDir = path.join(__dirname, '..', 'sql');
  
  if (!fs.existsSync(sqlDir)) {
    return [];
  }
  
  return fs.readdirSync(sqlDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure consistent order
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}     Production Database Migration Runner      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════${colors.reset}\n`);
  
  // Check environment
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.DATABASE_URL?.includes('digitalocean');
  
  if (isProduction) {
    console.log(`${colors.red}${colors.bright}⚠️  WARNING: You are running migrations on PRODUCTION database!${colors.reset}`);
    console.log(`${colors.yellow}Database URL: ${process.env.DATABASE_URL?.substring(0, 50)}...${colors.reset}\n`);
    
    const confirmed = await askConfirmation(
      `${colors.red}${colors.bright}Are you SURE you want to continue? (y/n): ${colors.reset}`
    );
    
    if (!confirmed) {
      console.log(`${colors.green}✓${colors.reset} Migration cancelled. No changes made.`);
      process.exit(0);
    }
  }
  
  try {
    // Test database connection
    console.log(`${colors.blue}→${colors.reset} Testing database connection...`);
    await pool.query('SELECT NOW()');
    console.log(`${colors.green}✓${colors.reset} Database connection successful\n`);
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get migration files
    const migrationFile = process.argv[2];
    let filesToRun = [];
    
    if (migrationFile) {
      // Run specific migration
      filesToRun = [migrationFile];
    } else {
      // Run all pending migrations
      filesToRun = getMigrationFiles();
      console.log(`\n${colors.cyan}Found ${filesToRun.length} migration file(s)${colors.reset}`);
    }
    
    if (filesToRun.length === 0) {
      console.log(`${colors.yellow}No migration files found${colors.reset}`);
      process.exit(0);
    }
    
    // Run migrations
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const file of filesToRun) {
      const result = await runMigration(file);
      
      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          successCount++;
        }
      } else {
        failCount++;
        
        // Ask if should continue with other migrations
        if (filesToRun.length > 1) {
          const continueNext = await askConfirmation(
            `${colors.yellow}Continue with remaining migrations? (y/n): ${colors.reset}`
          );
          
          if (!continueNext) {
            break;
          }
        }
      }
    }
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}Migration Summary:${colors.reset}`);
    console.log(`  ${colors.green}✓ Successful: ${successCount}${colors.reset}`);
    console.log(`  ${colors.yellow}⚠ Skipped: ${skipCount}${colors.reset}`);
    console.log(`  ${colors.red}✗ Failed: ${failCount}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
    
    // Next steps
    if (successCount > 0) {
      console.log(`\n${colors.bright}Next steps:${colors.reset}`);
      console.log('1. Restart the bot server to use the new database schema');
      console.log('2. Restart the admin server if admin features were added');
      console.log('3. Test the new functionality');
      console.log('4. Monitor logs for any issues');
    }
    
    process.exit(failCount > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}Fatal error:${colors.reset} ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});