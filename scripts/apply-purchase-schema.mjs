import { execFileSync } from "node:child_process";

function getNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function main() {
  const npx = getNpxCommand();

  execFileSync(npx, ["prisma", "db", "push"], {
    stdio: "inherit",
    env: process.env,
  });

  console.log("Purchase schema applied successfully.");
}

main();
