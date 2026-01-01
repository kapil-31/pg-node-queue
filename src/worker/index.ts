import { Pool } from "pg";
import { JobHandler } from "./types";
import { IdempotencyStore } from "../idempotency/Idempotency";

export class Worker<JobMap extends Record<string, any>> {
  private handlers: {
    [K in keyof JobMap]  : JobHandler<JobMap[K]>
  };
  private pool: Pool;
  private idempotency: IdempotencyStore;
  private workerId: string;

  constructor(
    queue: any,
    handlers: {
      [K in keyof JobMap]: JobHandler<JobMap[K]>;
    }
  ) {
    this.pool = (queue as any).pool;
    this.handlers = handlers;
    this.workerId = `worker-${process.pid}`;
    this.idempotency = new IdempotencyStore(this.pool);
  }

  async start() {
    while (true) {
      const job = await this.claimJob();
      if (!job) {
        await sleep(1000);
        continue;
      }

      let heartbeat: NodeJS.Timeout | null = null;

      try {
        heartbeat = setInterval(
          () => this.renewLease(job.id),
          10_000
        );

        const handler = this.handlers[job.type as keyof JobMap];
        if (!handler) {
          throw new Error(`No handler for job type ${job.type}`);
        }

        await handler(job.payload, {
          jobId: job.id,
          retryCount: job.retry_count,
          runOnce: (key, fn) =>
            this.idempotency.runOnce(
              `${job.id}:${key}`,
              fn
            ),
        });

        await this.completeJob(job.id);
      } catch (err: any) {
        await this.failJob(job.id, err.message);
      } finally {
        if (heartbeat) clearInterval(heartbeat);
      }
    }
  }

  private async claimJob() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query(
        `
        WITH job AS (
          SELECT id
          FROM jobs
          WHERE status IN ('PENDING', 'RETRYABLE')
            AND next_run_at <= NOW()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE jobs
        SET status = 'IN_PROGRESS',
            lease_owner = $1,
            lease_expires_at = NOW() + INTERVAL '30 seconds'
        WHERE id = (SELECT id FROM job)
        RETURNING *;
        `,
        [this.workerId]
      );

      await client.query("COMMIT");
      return res.rows[0] ?? null;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async renewLease(jobId: string) {
    const res = await this.pool.query(
      `
      UPDATE jobs
      SET lease_expires_at = NOW() + INTERVAL '30 seconds'
      WHERE id = $1 AND lease_owner = $2
      `,
      [jobId, this.workerId]
    );

    if (res.rowCount === 0) {
      console.error("Lease lost, exiting worker");
      process.exit(1);
    }
  }

  private async completeJob(jobId: string) {
    await this.pool.query(
      `
      UPDATE jobs
      SET status = 'COMPLETED',
          lease_owner = NULL,
          lease_expires_at = NULL
      WHERE id = $1 AND lease_owner = $2
      `,
      [jobId, this.workerId]
    );
  }

  private async failJob(jobId: string, error: string) {
    await this.pool.query(
      `
      UPDATE jobs
      SET retry_count = retry_count + 1,
          status = CASE
            WHEN retry_count + 1 >= max_retries
            THEN 'DEAD_LETTER'
            ELSE 'RETRYABLE'
          END,
          next_run_at = NOW() + INTERVAL '1 second' * POWER(2, retry_count),
          last_error = $3,
          lease_owner = NULL,
          lease_expires_at = NULL
      WHERE id = $1 AND lease_owner = $2
      `,
      [jobId, this.workerId, error]
    );
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
