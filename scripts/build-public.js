import { mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
rmSync("public", { recursive: true, force: true });
mkdirSync("public");
for (const name of readdirSync(".").filter(
  (n) => n.endsWith(".html") && n !== "automation.html",
))
  cpSync(name, "public/" + name);
for (const name of ["css", "js", "images"])
  cpSync(name, "public/" + name, { recursive: true });

// Explicit preview-only live check; never runs on a production build.
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.GLOWLAB_VERIFY_LIVE === "1"
) {
  const { logLiveVerification } = await import("./verify-live-gemini.js");
  await logLiveVerification();
}

// Explicit read-only diagnostic of the deployed production endpoint.
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.GLOWLAB_PROBE_DEPLOYED_LUMI === "1"
) {
  const { probeDeployedLumi } = await import("./probe-deployed-lumi.js");
  await probeDeployedLumi();
}
