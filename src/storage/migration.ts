import { Pool } from "pg";

export async function migrate(config: { connectionString: string }) {
  const pool = new Pool({ connectionString: config.connectionString });

  await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        
        status TEXT NOT NULL CHECK (
        status IN ('PENDING','IN_PROGRESS','RETRYABLE','COMPLETED','DEAD_LETTER')),

        idempotency_key TEXT UNIQUE,
        retry_count INT DEFAULT 0,
        max_retries INT DEFAULT 5,
        

        lease_owner TEXT,
        lease_expires_at TIMESTAMP,

        last_error TEXT,

        next_run_at TIMESTAMP DEFAULT NOW(),

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
        );
        
        `);

  console.log("================Migration Completed===========");
  await pool.end();
}
