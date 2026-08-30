module.exports = {
  apps: [
    {
      name: "amkaai-video-worker",
      script: "npm",
      args: "run worker:prod",
      cwd: process.cwd(),
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production",
        VIDEO_WORKER_CONCURRENCY: "1",
        VIDEO_WORKER_HEALTH_PORT: "8787",
      },
    },
    {
      name: "amkaai-gpu-reconciler",
      script: "npm",
      args: "run gpu:reconciler",
      cwd: process.cwd(),
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production",
        VIDEO_RECONCILE_INTERVAL_MS: "60000",
        VIDEO_RECONCILER_HEALTH_PORT: "8788",
      },
    },
  ],
};
