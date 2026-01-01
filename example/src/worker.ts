import "dotenv/config";
import { createQueue, Worker } from "node-queue";
import { Jobs } from "./jobs";

const queue = createQueue({
  connectionString: process.env.DATABASE_URL!,
});

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

  "process-video": async (payload, ctx) => {
    await ctx.runOnce("video", async () => {
      console.log(`🎬 Processing video ${payload.input}`);
    });
  },
});

worker.start();
