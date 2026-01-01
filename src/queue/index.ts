import { Pool } from "pg";
import { randomUUID } from "crypto";

export class Queue<JobMap extends Record<string,any>> {
  constructor(private pool: Pool) {}
  async add<K extends keyof JobMap>(
    type: K,
    payload: JobMap[K],
    options?: {
      idempotencyKey?: string;
      maxRetries?: number;
    }
  ) {
    const id = randomUUID();


    await this.pool.query(
      `
      INSERT INTO jobs (
        id, type, payload, status,
        idempotency_key, max_retries
      )
      VALUES ($1, $2, $3, 'PENDING', $4, $5)
      ON CONFLICT (idempotency_key) DO NOTHING
      `,
      [
        id,
        type,
        payload,
        options?.idempotencyKey ?? null,
        options?.maxRetries ?? 5,
      ]
    );

    return id;
  }
}

export function createQueue(config: { connectionString: string }) {
  const pool = new Pool({ connectionString: config.connectionString });
  return new Queue(pool);
}
