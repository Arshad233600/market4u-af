import sql, { ConnectionPool, config as SqlConfig } from "mssql";

// Singleton pool
let poolPromise: Promise<ConnectionPool> | null = null;

function buildConfig(): SqlConfig | string {
    const connectionString = process.env.SqlConnectionString || process.env.AZURE_SQL_CONNECTION_STRING;

    if (connectionString && connectionString.trim().length > 0) {
        return connectionString;
    }

    const { DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

    if (!DB_SERVER || !DB_NAME || !DB_USER || !DB_PASSWORD) {
        throw new Error(
            "Database not configured. Set SqlConnectionString or AZURE_SQL_CONNECTION_STRING in Azure App Service environment variables (Configuration > Application settings). " +
            "Format: Server=tcp:market4u-sql-server.database.windows.net,1433;Initial Catalog=market4u-db;User Id=<username>;Password=<password>;Encrypt=True;TrustServerCertificate=False;"
        );
    }

    return {
        server: DB_SERVER,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: false
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

export async function getPool(): Promise<ConnectionPool> {
    if (!poolPromise) {
        const config = buildConfig();

        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .catch((err: unknown) => {
                poolPromise = null; // allow retry
                throw err;
            });
    }

    return poolPromise;
}
