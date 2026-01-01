# pg-pg-node-queue

> 🚧 **Work in Progress** — Actively developed to explore reliable background job execution with PostgreSQL.

**pg-node-queue** is a Postgres-backed job queue engine for Node.js focused on **correctness, crash safety, retries, leasing, and idempotent side effects**.

It is designed as an **embeddable library**, not a hosted service or black-box framework.

---

## Why pg-node-queue?

Most job queues hide failure modes.  
`pg-node-queue` does the opposite.

This project exists to:
- Embrace retries instead of pretending they don’t happen
- Make worker crashes safe
- Prevent duplicate side effects
- Use PostgreSQL as a concurrency control system
- Keep the execution model explicit and understandable

---

## Features

- ✅ Durable jobs stored in PostgreSQL
- ✅ Transactional job claiming (`FOR UPDATE SKIP LOCKED`)
- ✅ Lease-based execution with heartbeats
- ✅ Automatic retries with exponential backoff
- ✅ Dead-letter handling
- ✅ Idempotent job submission
- ✅ Idempotent side effects via `ctx.runOnce()`
- ✅ Type-safe job definitions (TypeScript)
- ✅ Horizontal worker scaling
- ✅ Minimal CLI for database migrations

---

## What This Is NOT

- ❌ A hosted queue service
- ❌ A BullMQ / Sidekiq replacement
- ❌ A streaming system
- ❌ Exactly-once execution
- ❌ A UI-first product

---

## Requirements

- Node.js **18+**
- PostgreSQL **13+**

---

## Installation

```bash
npm install pg-node-queue
export DATABASE_URL=postgres://user@localhost:5432/database_name
⚠️ The CLI does not load .env files automatically.
Make sure DATABASE_URL is available in the environment.

npx pg-node-queue migrate
```

## Basic Concepts

Queue → used to enqueue jobs (producer)

Worker → pulls and executes jobs (consumer)

Job Handler → user-defined business logic

JobContext → framework-provided execution context


## Define Job Types (Type Safety)
Create a job map to define all job names and payloads.

```bash 
// jobs.ts
export type Jobs = {
  "send-email": {
    to: string;
    subject: string;
  };

  "process-image": {
    path: string;
    output: string;
  };

  "process-video": {
    input: string;
    output: string;
  };
};
 ```
 This gives compile-time safety on both producer and worker sides.



 ## Create a Queue (Producer)

 ```bash import { createQueue } from "pg-node-queue";
import { Jobs } from "./jobs";

const queue = createQueue<Jobs>({
  connectionString: process.env.DATABASE_URL!,
});
```


## Enqueue a Job

```bash 
await queue.add(
  "send-email",
  {
    to: "user@example.com",
    subject: "Welcome",
  },
  {
    idempotencyKey: "email:user@example.com:welcome",
    maxRetries: 5,
  }
);

```

### queue.add() Options

| Option           | Description                      |
| ---------------- | -------------------------------- |
| `idempotencyKey` | Prevents duplicate job insertion |
| `maxRetries`     | Maximum retry attempts           |



## Create a Worker (Consumer)

```bash 
import { Worker } from "pg-node-queue";
import { Jobs } from "./jobs";

const worker = new Worker<Jobs>(queue, {
  "send-email": async (payload, ctx) => {
    await ctx.runOnce("email", async () => {
      console.log(`📧 Sending email to ${payload.to}`);
    });
  },

  "process-image": async (payload, ctx) => {
    await ctx.runOnce("image", async () => {
      console.log(`🖼 Processing image ${payload.path}`);
    });
  },
});

worker.start();

```

### JobContext API
Each handler receives a JobContext object.
```bash
ctx.jobId       // Unique job ID
ctx.retryCount  // Current retry attempt
 ```

 ### Idempotent Side Effects (ctx.runOnce)

Jobs may execute more than once.
Side effects must not.

Use ctx.runOnce() to protect external actions:

```bash      
await ctx.runOnce("send-email", async () => {
  await mailer.send(payload);
});
   ```
### Guarantees:

- Executes at most once

- Safe under retries

- Safe under crashes

- Safe with multiple workers

- Principle: Jobs are retryable. Side effects are not.


### Retry & Backoff Model

- Failed jobs retry automatically

- Exponential backoff is enforced via the database

- Workers only claim jobs eligible to run

- Jobs exceeding retries move to DEAD_LETTER

- No worker-side sleep or timers are used.


### Worker Execution Model

- Workers pull jobs continuously

- One job per worker at a time

- Leases prevent duplicate execution

- Crashed workers do not lose jobs



### Use Cases

- Transactional emails

- Image processing / thumbnail generation

- Video transcoding

- File upload post-processing

- Webhook delivery

- Background data processing

- Cleanup & maintenance tasks


### Status

This project is under active development.
Breaking changes may occur before 1.0.0.


# License
MIT License

Copyright (c) 2025 Kapil Karki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
