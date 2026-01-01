import "dotenv/config";
import { createQueue } from "node-queue";

const queue = createQueue({
  connectionString: process.env.DATABASE_URL!,
});

async function main() {
  await queue.add("send-email", {
    to: "test@example.com",
    subject: "Welcome",
  });

   await queue.add("send-email", {
    to: "tes1t@example.com",
    subject: "Welcome",
  });

  await queue.add("process-image", {
    path: "./image.jpg",
    output: "./image-small.jpg",
  });

  await queue.add("process-video", {
    input: "./video.mp4",
    output: "./video-720p.mp4",
  });

  console.log(" Jobs enqueued");
}

main();
