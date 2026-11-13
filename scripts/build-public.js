import { mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
rmSync("public", { recursive: true, force: true });
mkdirSync("public");
for (const name of readdirSync(".").filter(
  (n) => n.endsWith(".html") && n !== "automation.html",
))
  cpSync(name, "public/" + name);
for (const name of ["css", "js", "images"])
  cpSync(name, "public/" + name, { recursive: true });
