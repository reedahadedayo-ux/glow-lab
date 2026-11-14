// Bound wall-clock time as well as SDK/transport timeout options. Abort is propagated
// to real providers; even a transport that ignores it cannot keep the UI waiting.
export async function withDeadline(operation, timeoutMs) {
  if (timeoutMs <= 0)
    throw Object.assign(new Error("Request timed out"), {
      name: "TimeoutError",
    });
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(new Error("Request timed out"), {
        name: "TimeoutError",
      });
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
