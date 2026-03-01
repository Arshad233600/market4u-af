# Market4U - Azure Static Web Apps Deployment

## Overview

Market4U is a fully DB-driven marketplace application built with:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Azure Functions v4 (Node.js + TypeScript)
- **Database**: Azure SQL Database
- **Hosting**: Azure Static Web Apps
- **Storage**: Azure Blob Storage (for images)

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Azure Static Web Apps                  │
│                                                 │
│  ┌──────────────┐        ┌──────────────────┐  │
│  │   Frontend   │        │  Azure Functions │  │
│  │   (React)    │◄──────►│     (Node.js)    │  │
│  │   /dist      │        │     /api/dist    │  │
│  └──────────────┘        └──────────────────┘  │
│         │                        │             │
└─────────┼────────────────────────┼─────────────┘
          │                        │
          │                        ▼
          │              ┌──────────────────┐
          │              │  Azure SQL DB    │
          │              └──────────────────┘
          │
          ▼
  ┌──────────────────┐
  │  Azure Blob      │
  │  Storage         │
  └──────────────────┘
```

## Database Schema

The application uses the following tables:
- **Users**: User accounts (email, password hash, profile info)
- **Ads**: Product listings with status tracking
- **AdImages**: Multiple images per ad
- **Favorites**: User saved ads
- **Messages**: Direct messaging between users
- **WalletTransactions**: Payment/balance history

See `api/sql/init.sql` for complete schema definition.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user profile

### Ads
- `GET /api/ads` - List all active ads (supports filtering by category, province)
- `GET /api/ads/{id}` - Get ad details
- `GET /api/ads/my-ads` - Get current user's ads (requires auth)
- `POST /api/ads` - Create new ad (requires auth)
- `PUT /api/ads/{id}` - Update ad (requires auth)
- `DELETE /api/ads/{id}` - Soft delete ad (requires auth)

### Favorites
- `GET /api/favorites` - Get user's favorite ads (requires auth)
- `POST /api/favorites/{adId}` - Add ad to favorites (requires auth)
- `DELETE /api/favorites/{adId}` - Remove from favorites (requires auth)

### Messages
- `GET /api/messages/inbox` - Get message inbox (requires auth)
- `GET /api/messages/thread/{userId}` - Get conversation thread (requires auth)
- `POST /api/messages` - Send message (requires auth)

### User Profile
- `GET /api/user/profile` - Get user profile (requires auth)
- `PUT /api/user/profile` - Update user profile (requires auth)

### File Upload
- `POST /api/upload/sas-token` - Get SAS token for blob upload
- `POST /api/upload` - Direct upload endpoint (fallback)

## Environment Variables

### Azure Static Web Apps Configuration

Add these in Azure Portal → Your Static Web App → Configuration:

```bash
# Database (required)
SqlConnectionString=Server=tcp:your-server.database.windows.net,1433;Initial Catalog=Market4U;Authentication=Active Directory Default;

# OR use individual parameters:
# DB_SERVER=your-server.database.windows.net
# DB_NAME=Market4U
# DB_USER=your-username
# DB_PASSWORD=your-password

# Auth (required in production)
AUTH_SECRET=your-random-secret-key-min-32-characters-long

# Azure Storage (required for image uploads)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=product-images

# Optional
GEMINI_API_KEY=your-google-gemini-api-key
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=your-key
```

### Frontend Environment

The frontend API base URL is resolved in `services/apiClient.ts` as:

```ts
const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
```

**Production (Azure Static Web App):** Add `VITE_API_BASE_URL=/api` in the Azure Static Web App
→ Configuration → Environment variables panel, then **redeploy** (or trigger a new build) for
the change to take effect. Using any absolute `https://*.azurewebsites.net` URL here will
bypass the SWA auth middleware and cause CORS / 401 errors.

**Local development:** create `.env.local` and point to the local Functions runtime:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:7071/api
VITE_USE_MOCK_DATA=false
```

## Local Development

### Prerequisites
- Node.js 20+
- Azure Functions Core Tools v4
- Azure SQL Database (or SQL Server)

### Setup

1. **Clone and install dependencies:**
```bash
# Root (frontend)
npm install

# API (backend)
cd api
npm install
cd ..
```

2. **Configure database:**
```bash
# Run the schema script on your Azure SQL Database
# See api/README_DB.md for detailed instructions
```

3. **Set environment variables:**
```bash
# Create api/local.settings.json
cat > api/local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SqlConnectionString": "Server=your-server;Database=Market4U;User Id=user;Password=pass;Encrypt=true;",
    "AUTH_SECRET": "dev-secret-key-change-in-production",
    "AZURE_STORAGE_CONNECTION_STRING": "your-connection-string",
    "AZURE_STORAGE_CONTAINER": "product-images"
  }
}
EOF
```

4. **Start development servers:**

Terminal 1 (API):
```bash
cd api
npm run build
npm start
```

Terminal 2 (Frontend):
```bash
npm run dev
```

5. **Access the app:**
- Frontend: http://localhost:5173
- API: http://localhost:7071/api

## Building for Production

### Build Both Components
```bash
# Build frontend
npm run build

# Build API
cd api
npm run build
cd ..
```

Output locations:
- Frontend: `/dist`
- API: `/api/dist`

## Deployment

### GitHub Actions (Automatic)

The included workflow `.github/workflows/azure-static-web-apps.yml` automatically:
1. Builds frontend to `/dist`
2. Builds API to `/api/dist`
3. Deploys to Azure Static Web Apps

### Manual Deployment

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy --app-location . --api-location api --output-location dist
```

## Security Notes

1. **Never commit secrets** - All sensitive values must be in environment variables
2. **AUTH_SECRET** - Generate a strong random key (min 32 chars) for production
3. **SQL Connection** - Use managed identity or strong passwords
4. **HTTPS Only** - Azure Static Web Apps enforces HTTPS by default
5. **Input Validation** - All API endpoints use parameterized queries (no SQL injection)
6. **Rate Limiting** - Ads creation is rate-limited to 1 per 60 seconds per user

## Testing Default Accounts

After running `sql/init.sql`, you can test with:

**Admin:**
- Email: `admin@market4u.com`
- Password: `admin123`

**User:**
- Email: `user@market4u.com`
- Password: `user123`

⚠️ Change these immediately in production!

## Monitoring

- **Application Insights**: Tracks API performance and errors
- **Static Web Apps Analytics**: Built-in traffic analytics
- **SQL Insights**: Database performance monitoring

## Troubleshooting

### API Returns 500 Errors
- Check Azure Static Web App logs
- Verify `SqlConnectionString` is set correctly
- Ensure database tables exist (run `sql/init.sql`)

### Authentication Not Working
- Verify `AUTH_SECRET` is set (same value in all function app instances)
- Check browser console for CORS errors
- Ensure token is in Authorization header: `Bearer <token>`

### Images Not Uploading
- Verify `AZURE_STORAGE_CONNECTION_STRING` is set
- Check blob container exists and has correct permissions
- Review browser network tab for upload errors

### Build Fails
- Ensure `package-lock.json` exists in both root and `/api`
- Node version must be 20+
- Run `npm install` in both locations

### Deployment Error: "No matching Static Web App was found or the api key was invalid"

This error means the GitHub Secret `AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN_TREE_00484D503` is missing, expired, or invalid.

**Steps to fix:**

1. **Get a new deployment token from Azure Portal:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Static Web App resource
   - In the left menu, click **Overview**
   - Click **Manage deployment token** button
   - Copy the token

2. **Update the GitHub Secret:**
   - Go to your GitHub repository
   - Click **Settings** → **Secrets and variables** → **Actions**
   - Find `AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN_TREE_00484D503`
   - Click **Update** and paste the new token
   - Click **Update secret**

3. **Re-run the workflow:**
   - Go to the **Actions** tab in GitHub
   - Find the failed workflow run
   - Click **Re-run all jobs**

## Project Structure

```
Market4U/
├── api/
│   ├── src/
│   │   ├── functions/       # API endpoints
│   │   │   ├── ads.ts
│   │   │   ├── auth.ts
│   │   │   ├── favorites.ts
│   │   │   ├── messages.ts
│   │   │   ├── user.ts
│   │   │   ├── upload.ts
│   │   │   └── ...
│   │   ├── utils/
│   │   │   └── authUtils.ts # Token validation
│   │   ├── db.ts           # Database connection pool
│   │   └── index.ts        # Function registration
│   ├── sql/
│   │   └── init.sql        # Database schema
│   ├── dist/               # Build output
│   ├── package.json
│   ├── tsconfig.json
│   └── README_DB.md
├── src/                    # Frontend React app
├── dist/                   # Frontend build output
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── staticwebapp.config.json
└── .github/
    └── workflows/
        └── azure-static-web-apps.yml
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Create pull request to `main`
5. Automatic deployment on merge

## License

Private - All Rights Reserved
