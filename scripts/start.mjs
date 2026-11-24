import { spawn } from "node:child_process";

const port = process.env.PORT || "3847";
const mode = process.argv[2] === "dev" ? "dev" : "start";
const child = spawn("npx", ["next", mode, "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
