// =============================================================================
// Market4U - Azure Infrastructure (Bicep Template)
// =============================================================================
// Usage:
//   az group create --name Market4U-RG --location uaenorth
//   az deployment group create \
//     --resource-group Market4U-RG \
//     --template-file infrastructure/main.bicep \
//     --parameters sqlAdminPassword='YOUR_STRONG_PASSWORD' \
//                  githubRepoUrl='https://github.com/YOUR_ORG/market4u-af' \
//                  githubBranch='main'
// =============================================================================

@description('Location for all resources. Recommended: uaenorth (Dubai) or centralindia')
param location string = 'uaenorth'

@description('Unique prefix for all resource names (3-10 lowercase letters/numbers)')
@minLength(3)
@maxLength(10)
param prefix string = 'market4u'

@description('SQL Server admin username')
param sqlAdminUsername string = 'market4uadmin'

@description('SQL Server admin password (min 8 chars, upper+lower+digit+symbol)')
@secure()
param sqlAdminPassword string

@description('GitHub repository URL (e.g. https://github.com/username/market4u-af)')
param githubRepoUrl string = ''

@description('GitHub branch to deploy from')
param githubBranch string = 'main'

@description('Google Gemini API Key (optional, for AI features)')
@secure()
param geminiApiKey string = ''

// =============================================================================
// Variables
// =============================================================================
var sqlServerName    = '${prefix}-sql-${uniqueString(resourceGroup().id)}'
var sqlDbName        = 'market4u-db'
var storageAccName   = '${prefix}stor${uniqueString(resourceGroup().id)}'
var staticWebAppName = '${prefix}-app'
var containerName    = 'product-images'
var authSecret       = uniqueString(resourceGroup().id, prefix, 'auth-secret-salt-2024')

// =============================================================================
// 1. Azure SQL Server
// =============================================================================
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminUsername
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure services to connect to SQL Server
resource sqlFirewallAzureServices 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Set connection policy to Redirect for lower latency (clients connect directly to the database node)
resource sqlConnectionPolicy 'Microsoft.Sql/servers/connectionPolicies@2023-05-01-preview' = {
  parent: sqlServer
  name: 'default'
  properties: {
    connectionType: 'Redirect'
  }
}

// =============================================================================
// 2. Azure SQL Database (Basic tier - ~$5/month)
// =============================================================================
resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: sqlDbName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GB
  }
}

// =============================================================================
// 3. Azure Storage Account (for product images)
// =============================================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
  }
}

// Create Blob Service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

// Create product-images container (public read access)
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'Blob'
  }
}

// =============================================================================
// 4. Azure Static Web App (Free tier - $0/month)
// =============================================================================
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: githubRepoUrl
    branch: githubBranch
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// App settings for Static Web App (environment variables)
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    SqlConnectionString: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDbName};Persist Security Info=False;User ID=${sqlAdminUsername};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;ApplicationName=market4u-api;'
    AUTH_SECRET: authSecret
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
    AZURE_STORAGE_CONTAINER: containerName
    GEMINI_API_KEY: geminiApiKey
  }
}

// =============================================================================
// Outputs
// =============================================================================
@description('URL of the deployed Static Web App')
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'

@description('SQL Server FQDN')
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName

@description('Storage Account name')
output storageAccountName string = storageAccount.name

@description('Static Web App deployment token (add to GitHub Secrets as AZURE_STATIC_WEB_APPS_API_TOKEN)')
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
