import { NextResponse } from "next/server";
import { fetchWithRetry, parseJsonLoose } from "@/lib/fetchWithRetry";
import { buildOkxUrl, normalizeOkxResponse } from "@/lib/okx";
import type { ComputeResult, OkxResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20; // 与 OKX pageSize=20 保持一致

function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

async function getBTCUSDT(): Promise<number> {
  const pools = [
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    "https://api-gcp.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
  ];

  let lastErr: unknown = null;

  for (const u of pools) {
    try {
      const { text } = await fetchWithRetry(
        u,
        { timeoutMs: 6500 },
        { times: 2, baseDelayMs: 250 }
      );
      const j = parseJsonLoose(text);
      const p = Number(j?.price);
      if (!Number.isFinite(p) || p <= 0) throw new Error("Bad BTCUSDT price");
      return p;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("Failed to fetch BTCUSDT");
}

async function fetchOkxPage(cursorB64: string): Promise<OkxResponse> {
  const url = buildOkxUrl(cursorB64);
  const { text } = await fetchWithRetry(
    url,
    {
      timeoutMs: 12000,
      headers: { "user-agent": "vercel-okx-sats/1.0" }
    },
    { times: 2, baseDelayMs: 350 }
  );

  const j = parseJsonLoose(text);
  return normalizeOkxResponse(j);
}

export async function GET(req: Request) {
  const u = new URL(req.url);

  const threshold = clampInt(
    Number(u.searchParams.get("threshold") ?? "0"),
    1,
    50_000_000
  );

  // ✅ maxPages 现在变成可选：不传就自动拉到 OKX 全部页
  const hasMaxPagesParam = u.searchParams.has("maxPages");
  let maxPages = hasMaxPagesParam
    ? clampInt(Number(u.searchParams.get("maxPages") ?? "30"), 1, 5000)
    : 1_000_000; // 先给个很大值，等拿到 count 再自动修正

  // ✅ 仍保留硬截止，避免函数被平台强行掐断
  const hardDeadlineMs = clampInt(
    Number(u.searchParams.get("deadlineMs") ?? "18000"),
    4000,
    25000
  );

  const started = Date.now();
  const warnings: string[] = [];

  if (!threshold || threshold <= 0) {
    return NextResponse.json(
      { ok: false, error: "threshold must be a positive integer" },
      { status: 400 }
    );
  }

  // 先取 BTC 价格（失败也不影响 OKX 统计，返回 warning）
  let btcusdt: number | null = null;
  try {
    btcusdt = await getBTCUSDT();
  } catch (e: any) {
    warnings.push(`Binance price unavailable: ${e?.message ?? String(e)}`);
    btcusdt = null;
  }

  let cursor: string | null = "MA=="; // btoa('0')
  let hasNext = true;

  let totalCount = 0;
  const matched: ComputeResult["items"] = [];
  let pagesFetched = 0;

  while (hasNext && pagesFetched < maxPages) {
    if (Date.now() - started > hardDeadlineMs) {
      warnings.push(`Stopped early due to deadlineMs=${hardDeadlineMs}`);
      break;
    }

    if (!cursor) break;

    const data = await fetchOkxPage(cursor);
    pagesFetched++;

    if (pagesFetched === 1) {
      totalCount = data?.data?.count ?? 0;

      // ✅ 自动模式：拿到 count 后，计算 OKX 理论总页数
      // 这样就是“OKX 有多少页就拉多少页”
      if (!hasMaxPagesParam && totalCount > 0) {
        const expectedPages = Math.ceil(totalCount / PAGE_SIZE);
        // 给一点缓冲，避免 count 变化导致少拉
        maxPages = expectedPages + 2;
      }
    }

    const items = data?.data?.items ?? [];
    for (const it of items) {
      const unitSats = Number(it?.unitPrice?.satPrice ?? 0);
      if (unitSats > 0 && unitSats <= threshold) {
        matched.push({
          name: it?.name ?? "",
          amount: Number(it?.amount ?? 0),
          unitSats,
          totalBTC: Number(it?.totalPrice?.price ?? 0),
          owner: it?.ownerAddress ?? "",
          tokenId: it?.tokenId ?? "",
          icon: it?.tickerIcon ?? ""
        });
      }
    }

    hasNext = Boolean(data?.data?.hasNext);
    cursor = data?.data?.cursor ?? null;
  }

  const matchedAmount = matched.reduce(
    (a, b) => a + (Number.isFinite(b.amount) ? b.amount : 0),
    0
  );

  const matchedBTC = matched.reduce(
    (a, b) => a + (Number.isFinite(b.totalBTC) ? b.totalBTC : 0),
    0
  );

  const matchedUSD = btcusdt ? matchedBTC * btcusdt : null;

  const result: ComputeResult = {
    ok: true,
    threshold,
    pagesFetched,
    totalCount,
    matchedItems: matched.length,
    matchedAmount,
    matchedBTC,
    btcusdt,
    matchedUSD,
    nextCursor: cursor ?? null,
    elapsedMs: Date.now() - started,
    sample: false,
    items: matched.slice(0, 50),
    warnings
  };

  return new NextResponse(JSON.stringify(result), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=2, stale-while-revalidate=15"
    }
  });
}
