#!/usr/bin/env node

/**
 * Import Historical Facebook Conversations
 * 
 * This script fetches and imports past conversations from Facebook Page
 * for the last 75 days into the PostgreSQL database.
 * 
 * Usage: node scripts/import-historical-conversations.js [--dry-run]
 * 
 * NOTE: This script is designed to run in production on DigitalOcean
 * where DATABASE_URL is automatically provided.
 */

require('dotenv').config();
const axios = require('axios');
const { pool, testConnection } = require('../src/db-config');
const readline = require('readline');

// Configuration
const DAYS_TO_FETCH = 75;
const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const RATE_LIMIT_DELAY = 200; // ms between API calls
const BATCH_SIZE = 50; // Process conversations in batches

// Command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Progress tracking
let stats = {
  totalConversations: 0,
  totalMessages: 0,
  newUsers: 0,
  existingUsers: 0,
  errors: []
};

// Utility function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create readline interface for progress updates
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Get Page ID from the access token
 */
async function getPageId() {
  try {
    const response = await axios.get(`${FACEBOOK_API_URL}/me`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,name'
      }
    });
    
    console.log(`✓ Connected to Page: ${response.data.name} (ID: ${response.data.id})`);
    return response.data.id;
  } catch (error) {
    console.error('Failed to get page ID:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch all conversations from the page
 */
async function fetchConversations(pageId) {
  console.log('\n📥 Fetching conversations...');
  
  let conversations = [];
  let nextUrl = `${FACEBOOK_API_URL}/${pageId}/conversations`;
  let params = {
    access_token: PAGE_ACCESS_TOKEN,
    fields: 'id,updated_time,participants,message_count',
    limit: 100
  };
  
  // Calculate cutoff date (75 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_FETCH);
  
  while (nextUrl) {
    try {
      const response = await axios.get(nextUrl, { params });
      
      if (response.data && response.data.data) {
        // Filter conversations by date
        const filteredConversations = response.data.data.filter(conv => {
          const updatedTime = new Date(conv.updated_time);
          return updatedTime >= cutoffDate;
        });
        
        conversations = conversations.concat(filteredConversations);
        
        // Check if we've gone past our date range
        if (filteredConversations.length < response.data.data.length) {
          console.log(`✓ Reached conversations older than ${DAYS_TO_FETCH} days`);
          break;
        }
        
        // Handle pagination
        if (response.data.paging && response.data.paging.next) {
          nextUrl = response.data.paging.next;
          params = {}; // Parameters are included in the next URL
          process.stdout.write(`\rFetched ${conversations.length} conversations...`);
          await delay(RATE_LIMIT_DELAY);
        } else {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    } catch (error) {
      console.error('\nError fetching conversations:', error.response?.data || error.message);
      stats.errors.push(`Failed to fetch conversations: ${error.message}`);
      break;
    }
  }
  
  console.log(`\n✓ Found ${conversations.length} conversations in the last ${DAYS_TO_FETCH} days`);
  return conversations;
}

/**
 * Fetch messages for a specific conversation
 */
async function fetchMessagesForConversation(conversationId) {
  try {
    const response = await axios.get(`${FACEBOOK_API_URL}/${conversationId}`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'messages{id,created_time,from,to,message,attachments}'
      }
    });
    
    if (response.data && response.data.messages && response.data.messages.data) {
      return response.data.messages.data;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error.response?.data?.error?.message || error.message);
    stats.errors.push(`Failed to fetch messages for conversation ${conversationId}`);
    return [];
  }
}

/**
 * Get or create user in database
 */
async function getOrCreateUser(participant) {
  if (!participant || !participant.id) return null;
  
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [participant.id]
    );
    
    if (existingUser.rows.length > 0) {
      stats.existingUsers++;
      
      // Update last interaction
      if (!isDryRun) {
        await pool.query(
          'UPDATE users SET last_interaction = CURRENT_TIMESTAMP WHERE id = $1',
          [participant.id]
        );
      }
      
      return participant.id;
    }
    
    // Create new user
    if (!isDryRun) {
      await pool.query(
        'INSERT INTO users (id, name, profile_pic, created_at, last_interaction) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [participant.id, participant.name || 'Facebook User', participant.email || null]
      );
    }
    
    stats.newUsers++;
    return participant.id;
  } catch (error) {
    console.error('Error creating user:', error.message);
    return null;
  }
}

/**
 * Check if message already exists in database
 */
async function messageExists(userId, timestamp) {
  try {
    const result = await pool.query(
      'SELECT id FROM conversations WHERE user_id = $1 AND timestamp = $2',
      [userId, new Date(timestamp)]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Save message to database
 */
async function saveMessage(userId, message, isFromPage) {
  try {
    // Check if message already exists to avoid duplicates
    const exists = await messageExists(userId, message.created_time);
    if (exists) {
      return false;
    }
    
    // Determine message and response based on who sent it
    const messageText = isFromPage ? null : message.message;
    const responseText = isFromPage ? message.message : null;
    
    if (!isDryRun) {
      await pool.query(
        'INSERT INTO conversations (user_id, message, response, timestamp) VALUES ($1, $2, $3, $4)',
        [userId, messageText, responseText, new Date(message.created_time)]
      );
    }
    
    stats.totalMessages++;
    return true;
  } catch (error) {
    console.error('Error saving message:', error.message);
    return false;
  }
}

/**
 * Process a single conversation
 */
async function processConversation(conversation, pageId) {
  try {
    // Get participants
    const participants = conversation.participants?.data || [];
    const user = participants.find(p => p.id !== pageId);
    
    if (!user) {
      console.log(`⚠ Skipping conversation ${conversation.id}: No user participant found`);
      return;
    }
    
    // Get or create user
    const userId = await getOrCreateUser(user);
    if (!userId) {
      console.log(`⚠ Skipping conversation ${conversation.id}: Failed to create user`);
      return;
    }
    
    // Fetch messages for this conversation
    const messages = await fetchMessagesForConversation(conversation.id);
    
    // Process each message
    for (const message of messages) {
      const isFromPage = message.from?.id === pageId;
      await saveMessage(userId, message, isFromPage);
    }
    
    stats.totalConversations++;
    await delay(RATE_LIMIT_DELAY);
  } catch (error) {
    console.error(`Error processing conversation ${conversation.id}:`, error.message);
    stats.errors.push(`Failed to process conversation ${conversation.id}`);
  }
}

/**
 * Main import function
 */
async function importHistoricalConversations() {
  console.log('🚀 Facebook Historical Conversations Import');
  console.log('==========================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no data will be saved)' : 'LIVE IMPORT'}`);
  console.log(`Period: Last ${DAYS_TO_FETCH} days`);
  console.log('');
  
  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    await testConnection();
    console.log('✓ Database connected successfully');
    
    // Get page ID
    const pageId = await getPageId();
    
    // Fetch all conversations
    const conversations = await fetchConversations(pageId);
    
    if (conversations.length === 0) {
      console.log('\n⚠ No conversations found in the specified period');
      return;
    }
    
    // Process conversations in batches
    console.log('\n📝 Processing conversations...');
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      const batch = conversations.slice(i, Math.min(i + BATCH_SIZE, conversations.length));
      
      for (const conversation of batch) {
        process.stdout.write(`\rProcessing conversation ${i + 1}/${conversations.length}...`);
        await processConversation(conversation, pageId);
      }
    }
    
    // Print summary
    console.log('\n\n✅ Import Complete!');
    console.log('==========================================');
    console.log(`📊 Summary:`);
    console.log(`   • Total Conversations Processed: ${stats.totalConversations}`);
    console.log(`   • Total Messages Imported: ${stats.totalMessages}`);
    console.log(`   • New Users Created: ${stats.newUsers}`);
    console.log(`   • Existing Users Updated: ${stats.existingUsers}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠ Errors encountered (${stats.errors.length}):`);
      stats.errors.slice(0, 5).forEach(error => {
        console.log(`   • ${error}`);
      });
      if (stats.errors.length > 5) {
        console.log(`   ... and ${stats.errors.length - 5} more`);
      }
    }
    
    if (isDryRun) {
      console.log('\n📌 This was a DRY RUN - no data was actually saved');
      console.log('   Run without --dry-run flag to perform actual import');
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Validate environment
if (!PAGE_ACCESS_TOKEN) {
  console.error('❌ Error: PAGE_ACCESS_TOKEN not found in environment variables');
  console.error('   Please ensure your .env file contains PAGE_ACCESS_TOKEN');
  process.exit(1);
}

// Run the import
importHistoricalConversations()
  .then(() => {
    console.log('\n👋 Import process finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });