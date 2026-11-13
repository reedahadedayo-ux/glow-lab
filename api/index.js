import { runtime } from "../server/runtime.js";
let application;
export default async function handler(req, res) {
  try {
    application ??= runtime();
    return (await application)(req, res);
  } catch {
    application = undefined;
    res.status(503).json({
      code: "SERVER_CONFIGURATION",
      error:
        "Server configuration is incomplete. Check database and session environment variables.",
    });
  }
}
