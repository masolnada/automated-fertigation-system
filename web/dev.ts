// Start both the Express server and the dashboard dev server; forward their output.
const procs = [
  Bun.spawn(["bun", "apps/server/src/main.ts"], { stdout: "inherit", stderr: "inherit", stdin: "inherit" }),
  Bun.spawn(["bun", "apps/dashboard/dev.ts"], { stdout: "inherit", stderr: "inherit", stdin: "inherit" }),
];
const stop = () => { for (const proc of procs) proc.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race(procs.map((proc) => proc.exited));
stop();
