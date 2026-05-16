import { spawn } from "node:child_process";

const RESTART_DELAY_MS = 3000;

const DEFAULT_NODE_FLAGS = [
  "--trace-warnings",
  "--trace-uncaught",
  "--enable-source-maps",
];

function uniqueFlags(flags) {
  return [...new Set(flags)];
}

function getNodeArgs() {
  return uniqueFlags([...process.execArgv, ...DEFAULT_NODE_FLAGS, "main.js"]);
}

function startMain() {
  const mainProcess = spawn(process.execPath, getNodeArgs(), {
    stdio: ["inherit", "pipe", "pipe"],
  });

  mainProcess.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;

    console.log(`main.js exited with ${reason}`);
    console.log("Circuit breaker activated!");
    console.log(`Restarting main.js in ${RESTART_DELAY_MS / 1000} seconds...`);

    setTimeout(startMain, RESTART_DELAY_MS);
  });

  mainProcess.stdout.on("data", (data) => {
    process.stdout.write(`output from main.js: ${data}`);
  });

  mainProcess.stderr.on("data", (data) => {
    process.stderr.write(`error in main.js: ${data}`);
  });
}

startMain();
