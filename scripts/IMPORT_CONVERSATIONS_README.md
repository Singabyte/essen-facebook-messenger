# Import Historical Facebook Conversations

This script allows you to import past conversations from your Facebook Page into the database. It fetches conversations from the last 75 days and stores them in your PostgreSQL database.

## Prerequisites

1. **Production Environment**: This script is designed to run on DigitalOcean App Platform where DATABASE_URL is automatically provided
2. **Facebook Page Access Token**: Must have the following permissions:
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `pages_messaging`

## Running the Script in Production

### Option 1: Run via DigitalOcean Console

1. Go to your DigitalOcean App Platform dashboard
2. Navigate to your app → "Console" tab
3. Run the following commands:

```bash
# First, do a dry run to see what will be imported
node scripts/import-historical-conversations.js --dry-run

# If everything looks good, run the actual import
node scripts/import-historical-conversations.js
```

### Option 2: SSH into your Droplet (if using Droplet instead of App Platform)

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Navigate to the application directory
cd /var/www/essen-facebook-messenger

# Run the import script
node scripts/import-historical-conversations.js --dry-run
node scripts/import-historical-conversations.js
```

### Option 3: Run as a Job in App Platform

You can add this as a one-time job in your `app.yaml`:

```yaml
jobs:
  - name: import-conversations
    kind: PRE_DEPLOY
    source_dir: /
    run_command: node scripts/import-historical-conversations.js
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
```

## What the Script Does

1. **Connects to Facebook Graph API** using your PAGE_ACCESS_TOKEN
2. **Fetches all conversations** from the last 75 days
3. **For each conversation**:
   - Retrieves all messages
   - Creates or updates user records
   - Stores messages in the conversations table
4. **Handles duplicates** - won't re-import messages that already exist
5. **Provides progress updates** throughout the process

## Script Options

- `--dry-run`: Simulates the import without saving any data (recommended for first run)

## Expected Output

```
🚀 Facebook Historical Conversations Import
==========================================
Mode: LIVE IMPORT
Period: Last 75 days

📊 Testing database connection...
✓ Database connected successfully
✓ Connected to Page: ESSEN Singapore (ID: 123456789)

📥 Fetching conversations...
✓ Found 150 conversations in the last 75 days

📝 Processing conversations...
Processing conversation 150/150...

✅ Import Complete!
==========================================
📊 Summary:
   • Total Conversations Processed: 150
   • Total Messages Imported: 1,234
   • New Users Created: 45
   • Existing Users Updated: 105
```

## Troubleshooting

### Error: "PAGE_ACCESS_TOKEN not found"
- Ensure your environment variables are properly set in DigitalOcean App Platform
- Check: App Settings → Environment Variables

### Error: "Failed to get page ID"
- Verify your PAGE_ACCESS_TOKEN is valid
- Check token permissions at: https://developers.facebook.com/tools/debug/accesstoken/

### Error: "Database connection failed"
- Ensure DATABASE_URL is properly configured (automatic in DigitalOcean)
- Check database is running and accessible

### Rate Limiting
- The script includes built-in delays to avoid Facebook API rate limits
- If you encounter rate limit errors, the script will continue and report errors at the end

## Important Notes

1. **First Time Setup**: Run with `--dry-run` first to verify everything works
2. **Time Required**: Importing can take 10-30 minutes depending on conversation volume
3. **Database Impact**: The script adds new records but doesn't modify existing ones
4. **Idempotent**: Safe to run multiple times - won't create duplicates

## Data Privacy

- All imported data is stored securely in your private PostgreSQL database
- No data is sent to external services besides Facebook's API
- User privacy is maintained according to Facebook's platform policies