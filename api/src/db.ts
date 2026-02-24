import sql, { ConnectionPool, config as SqlConfig } from "mssql";

// Singleton pool
let poolPromise: Promise<ConnectionPool> | null = null;

function buildConfig(): SqlConfig | string {
    const connectionString = process.env.SqlConnectionString;

    if (connectionString && connectionString.trim().length > 0) {
        return connectionString;
    }

    const { DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

    if (!DB_SERVER || !DB_NAME || !DB_USER || !DB_PASSWORD) {
        throw new Error(
            "Database configuration missing. Provide SqlConnectionString or DB_SERVER/DB_NAME/DB_USER/DB_PASSWORD."
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
