#!/usr/bin/env node

/**
 * Verify environment variables are properly set
 * Run this in DigitalOcean console to check configuration
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}=== Environment Variable Verification ===${colors.reset}\n`);

// Required environment variables
const requiredVars = [
  { name: 'PAGE_ACCESS_TOKEN', description: 'Facebook Page Access Token', sensitive: true },
  { name: 'VERIFY_TOKEN', description: 'Facebook Webhook Verification Token', sensitive: true },
  { name: 'APP_SECRET', description: 'Facebook App Secret', sensitive: true },
  { name: 'GEMINI_API_KEY', description: 'Google Gemini API Key', sensitive: true },
  { name: 'JWT_SECRET', description: 'Admin Interface JWT Secret', sensitive: true },
  { name: 'DATABASE_URL', description: 'PostgreSQL Connection String', sensitive: true }
];

// Optional/automatic variables
const optionalVars = [
  { name: 'PORT', description: 'Server Port' },
  { name: 'NODE_ENV', description: 'Node Environment' },
  { name: 'DB_PATH', description: 'SQLite Path (not used in production)' }
];

let allGood = true;

console.log(`${colors.yellow}Required Environment Variables:${colors.reset}`);
requiredVars.forEach(({ name, description, sensitive }) => {
  const value = process.env[name];
  if (value) {
    if (sensitive) {
      // Show only partial value for sensitive data
      const maskedValue = value.length > 10 
        ? value.substring(0, 4) + '...' + value.substring(value.length - 4)
        : '***';
      console.log(`${colors.green}✓${colors.reset} ${name}: ${maskedValue} (${value.length} chars) - ${description}`);
    } else {
      console.log(`${colors.green}✓${colors.reset} ${name}: ${value} - ${description}`);
    }
  } else {
    console.log(`${colors.red}✗${colors.reset} ${name}: NOT SET - ${description}`);
    allGood = false;
  }
});

console.log(`\n${colors.yellow}Optional/Automatic Variables:${colors.reset}`);
optionalVars.forEach(({ name, description }) => {
  const value = process.env[name];
  if (value) {
    console.log(`${colors.green}✓${colors.reset} ${name}: ${value} - ${description}`);
  } else {
    console.log(`${colors.yellow}○${colors.reset} ${name}: not set - ${description}`);
  }
});

// Check database connectivity
console.log(`\n${colors.yellow}Database Configuration:${colors.reset}`);
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`${colors.green}✓${colors.reset} Database Type: PostgreSQL`);
    console.log(`${colors.green}✓${colors.reset} Host: ${url.hostname}`);
    console.log(`${colors.green}✓${colors.reset} Port: ${url.port}`);
    console.log(`${colors.green}✓${colors.reset} Database: ${url.pathname.substring(1)}`);
    console.log(`${colors.green}✓${colors.reset} SSL Mode: ${url.searchParams.get('sslmode') || 'not specified'}`);
  } catch (e) {
    console.log(`${colors.red}✗${colors.reset} Invalid DATABASE_URL format`);
  }
} else {
  console.log(`${colors.red}✗${colors.reset} DATABASE_URL not set - database connection will fail`);
}

// Summary
console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
if (allGood) {
  console.log(`${colors.green}✓ All required environment variables are set!${colors.reset}`);
  console.log('\nYour bot should be able to:');
  console.log('  • Connect to Facebook Messenger');
  console.log('  • Process messages with Gemini AI');
  console.log('  • Store data in PostgreSQL');
  console.log('  • Provide admin interface access');
} else {
  console.log(`${colors.red}✗ Some required environment variables are missing!${colors.reset}`);
  console.log('\nTo fix this:');
  console.log('1. Go to DigitalOcean App Platform dashboard');
  console.log('2. Navigate to Settings → Environment Variables');
  console.log('3. Add the missing variables as "Encrypted" secrets');
  console.log('4. Redeploy your app');
}

// Test token validity (optional)
if (process.env.PAGE_ACCESS_TOKEN && process.argv.includes('--test-facebook')) {
  console.log(`\n${colors.yellow}Testing Facebook token...${colors.reset}`);
  const https = require('https');
  
  https.get(`https://graph.facebook.com/v18.0/me?access_token=${process.env.PAGE_ACCESS_TOKEN}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.id) {
          console.log(`${colors.green}✓ Facebook token is valid for page: ${response.name} (ID: ${response.id})${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Facebook token validation failed: ${data}${colors.reset}`);
        }
      } catch (e) {
        console.log(`${colors.red}✗ Failed to parse Facebook response${colors.reset}`);
      }
    });
  }).on('error', (e) => {
    console.log(`${colors.red}✗ Failed to connect to Facebook: ${e.message}${colors.reset}`);
  });
}