import { spawn } from "node:child_process";

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
