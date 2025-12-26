export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  retry = { times: 2, baseDelayMs: 350 }
) {
  const timeoutMs = init.timeoutMs ?? 9000;

  let lastErr: unknown = null;

  for (let i = 0; i <= retry.times; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(init.headers || {})
        }
      });

      if (!res.ok) {
        const text = await safeReadText(res);
        throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text?.slice(0, 160) ?? ""}`);
      }

      // 有些代理/上游会给 text/plain，但内容仍是 JSON
      const text = await res.text();
      return { res, text };
    } catch (e) {
      lastErr = e;
      if (i < retry.times) {
        const delay = retry.baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw lastErr;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr;
}

async function safeReadText(res: Response) {
  try {
    return await res.text();
  } catch {
    return null;
  }
}

export function parseJsonLoose(text: string) {
  // 兼容前面夹杂一些非 JSON 字符的情况
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^[^\[{]+/, "");
    return JSON.parse(cleaned);
  }
}
