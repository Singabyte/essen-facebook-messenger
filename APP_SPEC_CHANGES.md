# App Spec Environment Variable Updates

## Key Changes Made:

### 1. Updated PAGE_ACCESS_TOKEN (both services)
**Old:** `EAAQXGZAGJDh0BPH0SdKQ7cFoZBIWnZCZA1gLVqHGY9owQ8oCFSzZBGrN8mwI2H5oSaLe89PLZBoOPCYl6GEP7ZCihZCZA20D2YAB2TPK2T1nEd3p7R9ZCOGotPcM0XYHZAVwEXCud9GnDezSZA6QqHRlsYOLZB2vLBYz1jRZCleiZA5KCajP6xBcZChZAeuYydAWWYZAHCVf191CuZACA0ZD`

**New:** `EAAQXGZAGJDh0BPa9dvUr7ZC77Xh4rRbYcSt2W2eS3PsXCwZAwNzkrvRwM9tLjZADdVl9fZA3EAnLVoRsFyIppnrCGg3tmTppZBeh97okegB2AZBhBwdmkCqnW8gQiEUsP9fxWidzjEBaJoNKhih7Br8ZA49D36ZC1mvbWDzjXZAxcBuqvZCrgZCpIkyY7pzasLewX29Tfgq2JS0ZD`

### 2. Corrected INSTAGRAM_BUSINESS_ACCOUNT_ID
**Old:** `67126555778` (incorrect ID)  
**New:** `17841467073360819` (correct Instagram Business Account ID for essen.sg)

### 3. Added INSTAGRAM_PAGE_ACCESS_TOKEN (NEW)
**Value:** `EAAQXGZAGJDh0BPQOcsZCDku5TDg4zgsZAyvesZATwclkaAoVOTmCwkBPJ0BTxgeiPXjQHkxmHU8mI54hOZCUnraMp53s8qfx7snfSzVli1bQXCDiOCuW2TcTPr3ZCZCb4lompITpBQnAlTeB34DFrzJgMd9DNA3As5ctn2bjc0YGu12l1GILADjKq4jfQkucsdz4G8kZCUQZD`

This token has the required Instagram permissions:
- `instagram_basic`
- `instagram_manage_messages`
- `pages_messaging`

## How to Apply Changes:

### Option 1: Via DigitalOcean Console
1. Go to your app in DigitalOcean App Platform
2. Click on "Settings" → "App Spec"
3. Click "Edit"
4. Replace with the content from `app-spec-updated.yaml`
5. Click "Save"

### Option 2: Via doctl CLI
```bash
doctl apps update <your-app-id> --spec app-spec-updated.yaml
```

### Option 3: Manual Environment Variable Update
Go to Settings → Component Settings → facebook-bot → Environment Variables and update:
- `PAGE_ACCESS_TOKEN` (with new value)
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` = `17841467073360819`
- Add `INSTAGRAM_PAGE_ACCESS_TOKEN` (with new value)

## Important Notes:

1. **Both services** (facebook-bot and admin-api) need the updated PAGE_ACCESS_TOKEN
2. The INSTAGRAM_BUSINESS_ACCOUNT_ID is now the correct ID for your essen.sg Instagram account
3. The new INSTAGRAM_PAGE_ACCESS_TOKEN has the proper Instagram permissions
4. After applying changes, the app will automatically redeploy

## Verification:

After deployment, test Instagram webhooks:
1. Send a message to @essen.sg on Instagram
2. Check logs: `doctl apps logs <your-app-id> --type=run`
3. Visit: `https://essen-messenger-bot-zxxtw.ondigitalocean.app/debug/webhooks`