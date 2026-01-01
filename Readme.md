# node-queue

> 🚧 **Work in Progress** — Actively developed to explore reliable background job execution with PostgreSQL.

**node-queue** is a Postgres-backed job queue engine for Node.js focused on **correctness, crash safety, retries, leasing, and idempotent side effects**.

It is designed as an **embeddable library**, not a hosted service or black-box framework.

---

## Why node-queue?

Most job queues hide failure modes.  
`node-queue` does the opposite.

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
npm install node-queue
export DATABASE_URL=postgres://user@localhost:5432/database_name
⚠️ The CLI does not load .env files automatically.
Make sure DATABASE_URL is available in the environment.

npx node-queue migrate
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

 ```bash import { createQueue } from "node-queue";
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
import { Worker } from "node-queue";
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