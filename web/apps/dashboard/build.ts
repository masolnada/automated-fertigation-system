import { rm } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";
await rm("./dist", { recursive: true, force: true });
const result = await Bun.build({ entrypoints: ["./src/index.html"], plugins: [tailwind], minify: true, sourcemap: "linked", define: { "process.env.NODE_ENV": '"production"' }, outdir: "./dist" });
if (!result.success) { console.error(result.logs); process.exit(1); }
