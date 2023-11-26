/**
 * Helper functions such as `cmd` or `log`.
 */

import { spawn } from "node:child_process";

/**
 * Log `obj` to standard output.
 * If `obj` is an object, log its JSON representation instead.
 * @param {any} obj
 */
export function log(obj) {
  const type = typeof obj;
  if (type === "object") {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    console.log(obj);
  }
}

export function cmd(...command) {
  console.log(command);
  let p = spawn(command[0], command.slice(1));
  return new Promise((resolveFunc, rejectFunc) => {
    p.stdout.on("data", (x) => {
      process.stdout.write(x.toString());
    });
    p.stderr.on("data", (x) => {
      process.stderr.write(x.toString());
    });
    p.on("exit", (code) => {
      if (code === 0) {
        resolveFunc(code);
      } else {
        console.error(`${command[0]} exited with ${code}`);
        rejectFunc(code);
      }
    });
  });
}
