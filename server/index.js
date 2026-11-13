import { runtime } from "./runtime.js";
const app = await runtime();
app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    `GlowLab running on port ${process.env.PORT || 3000}; storage=${process.env.DATA_BACKEND || "supabase (requires configuration)"}`,
  ),
);
