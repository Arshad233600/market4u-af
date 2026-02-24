# Database Setup Guide

## Prerequisites
- Azure SQL Database provisioned
- SQL Server Management Studio, Azure Data Studio, or sqlcmd installed

## Environment Variables

Add these to your Azure Static Web Apps configuration or local `.env` file:

### Option 1: Connection String (Recommended)
```
SqlConnectionString=Server=tcp:your-server.database.windows.net,1433;Initial Catalog=your-database;Authentication=Active Directory Default;
```

### Option 2: Individual Parameters
```
DB_SERVER=your-server.database.windows.net
DB_NAME=your-database
DB_USER=your-username
DB_PASSWORD=your-password
```

## Running the Schema Script

### Using Azure Portal Query Editor
1. Go to Azure Portal → Your SQL Database → Query editor
2. Login with your credentials
3. Copy and paste the contents of `sql/init.sql`
4. Click "Run"

### Using Azure Data Studio or SSMS
1. Connect to your Azure SQL Database
2. Open `sql/init.sql`
3. Execute the script

### Using sqlcmd
```bash
sqlcmd -S your-server.database.windows.net -d your-database -U your-username -P your-password -i sql/init.sql
```

## Default Test Accounts

After running the script, you can login with:

**Admin Account:**
- Email: `admin@market4u.com`
- Password: `admin123`

**Regular User:**
- Email: `user@market4u.com`
- Password: `user123`

⚠️ **Security Note**: Change these passwords immediately in production!

## Verification

Run this query to verify tables were created:
```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
```

You should see: Users, Ads, AdImages, Favorites, Messages, WalletTransactions

## Schema Updates

To modify the schema after initial setup:
1. Create a new migration script in `sql/migrations/`
2. Name it with timestamp: `YYYY-MM-DD_description.sql`
3. Apply manually or via CI/CD pipeline
