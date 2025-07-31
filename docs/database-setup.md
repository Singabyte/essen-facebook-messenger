# Database Setup Guide

This application supports both SQLite (for local development) and PostgreSQL (for production).

## Local Development (SQLite)

By default, the application uses SQLite for local development. No additional setup is required.

```bash
# The database will be created automatically at ./database/bot.db
npm run dev
```

## Production (PostgreSQL)

For production deployment on DigitalOcean, we use PostgreSQL for better performance and to share data between services.

### Automatic Setup

When deploying to DigitalOcean App Platform, a PostgreSQL database will be automatically created based on the configuration in `.do/app.yaml`.

### Manual Setup

If you need to set up PostgreSQL manually:

1. **Create a PostgreSQL database**
   ```bash
   createdb essen_bot
   ```

2. **Set the DATABASE_URL environment variable**
   ```bash
   export DATABASE_URL="postgresql://username:password@localhost:5432/essen_bot"
   ```

3. **Run the application**
   ```bash
   npm start
   ```

The tables will be created automatically on first run.

## Migrating from SQLite to PostgreSQL

If you have existing data in SQLite that you want to migrate to PostgreSQL:

1. **Ensure both databases are accessible**
   ```bash
   export SQLITE_PATH="./database/bot.db"  # Path to your SQLite database
   export DATABASE_URL="postgresql://username:password@localhost:5432/essen_bot"
   ```

2. **Run the migration script**
   ```bash
   node scripts/migrate-to-postgresql.js
   ```

This will copy all data from SQLite to PostgreSQL, including:
- Users
- Conversations
- User preferences
- Analytics events
- Appointments
- Admin users

## Environment Variables

### For SQLite (Development)
```env
DB_PATH=./database/bot.db
```

### For PostgreSQL (Production)
```env
DATABASE_URL=postgresql://username:password@host:port/database_name
```

**Note**: If `DATABASE_URL` is set, PostgreSQL will be used. Otherwise, SQLite will be used.

## Database Schema

Both SQLite and PostgreSQL use the same schema:

- `users` - Facebook user profiles
- `conversations` - Message history
- `user_preferences` - User settings (JSON)
- `analytics` - Event tracking (JSON)
- `appointments` - Appointment bookings
- `admin_users` - Admin interface users
- `audit_logs` - Admin activity logs (JSON)

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running: `pg_ctl status`
- Check connection string format
- Verify firewall rules allow database connections

### Migration Issues
- Ensure both databases are accessible
- Check for sufficient disk space
- Review migration logs for specific errors

### Performance
- PostgreSQL includes indexes on frequently queried columns
- Monitor slow queries with `EXPLAIN ANALYZE`
- Consider connection pooling for high traffic