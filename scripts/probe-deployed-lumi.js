// Read-only probe of the actual public production route, not a mocked/local handler.
// Run only by explicit opt-in from a host allowed to reach Vercel. Never logs tokens or text.
export async function probeDeployedLumi() {
  const base = "https://glow-lab-puce.vercel.app";
  const report = {
    kind: "ACTUAL_PUBLIC_LUMI_HTTP",
    host: new URL(base).hostname,
    checks: [],
  };
  let cookie = "",
    historyToken;
  async function request(name, path, body) {
    const started = Date.now();
    try {
      const response = await fetch(base + "/api/" + path, {
        method: body ? "POST" : "GET",
        redirect: "manual",
        headers: {
          cookie,
          ...(body ? { "content-type": "application/json", origin: base } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(115000),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const data = await response.json().catch(() => ({}));
      report.checks.push({
        name,
        status: response.status,
        elapsedMs: Date.now() - started,
        code: typeof data.code === "string" ? data.code : null,
        requestId: data.requestId || null,
        hasText: !!data.text,
        productIds: (data.products || []).map((p) => p.id),
        hasRoutine: !!data.routine,
      });
      if (data.historyToken) historyToken = data.historyToken;
      return response.ok;
    } catch (error) {
      report.checks.push({
        name,
        status: 0,
        elapsedMs: Date.now() - started,
        code:
          error.name === "TimeoutError"
            ? "PROBE_TIMEOUT"
            : "PROBE_TRANSPORT_ERROR",
      });
      return false;
    }
  }
  await request("configuration", "config");
  const hello = await request("greeting", "lumi", { message: "Hello Lumi" });
  await request("product_search", "lumi", {
    message:
      "Find CeraVe Foaming Facial Cleanser in the catalogue and tell me the price.",
    ...(hello && historyToken ? { historyToken } : {}),
  });
  report.passed =
    report.checks.every((c) => c.status === 200) &&
    report.checks.find((c) => c.name === "greeting")?.hasText === true &&
    report.checks.find((c) => c.name === "product_search")?.hasText === true;
  console.log("GLOWLAB_PUBLIC_LUMI_PROBE " + JSON.stringify(report));
  return report;
}
