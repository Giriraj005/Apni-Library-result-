import { Container, getContainer } from "@cloudflare/containers";

// Cloudflare boots your existing Docker image inside this class.
// It behaves like a tiny wrapper around the container you already have.
export class ResultWorker extends Container {
  // MUST match the port your Express server listens on (process.env.PORT).
  // Change 3000 below if your app uses a different port.
  defaultPort = 3000;

  // Container goes to sleep after 5 minutes idle, wakes on next request
  // (this is what replaces Render's cold-start behavior).
  sleepAfter = "5m";

  constructor(ctx, env) {
    super(ctx, env);
    // These get passed into the container as env vars on startup -
    // same names you were using on Railway/Render.
    this.envVars = {
      WORKER_SECRET: env.WORKER_SECRET,
      INCLUDE_SCREENSHOT: env.INCLUDE_SCREENSHOT ?? "false",
      PORT: "3000",
    };
  }
}

export default {
  async fetch(request, env) {
    // Single always-on instance is enough for this use case
    // (one cron job hitting one worker, not many parallel users).
    const container = getContainer(env.RESULT_WORKER);
    return container.fetch(request);
  },
};
