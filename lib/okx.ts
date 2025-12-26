import { OkxResponse } from "./types";

export const OKX_BASE =
  process.env.OKX_BASE ??
  "https://web3.okx.com/priapi/v1/nft/inscription/ordi-rc20/detail/items";

// 你原来用的 ticker：₿\u061c（必须保持一致）
export const TICKER = "₿\u061c";

export function buildOkxUrl(cursorB64: string) {
  const p = new URLSearchParams({
    cursor: cursorB64,
    orderType: "1",
    pageSize: "20",
    ticker: TICKER,
    tickerId: "",
    tickerType: "0",
    showPending: "false",
    t: String(Date.now())
  });
  return `${OKX_BASE}?${p.toString()}`;
}

export function normalizeOkxResponse(j: any): OkxResponse {
  // 兼容 data.content 包裹
  try {
    if (j && j.data && typeof j.data.content === "string") {
      const inner = JSON.parse(j.data.content);
      if (inner?.data && Array.isArray(inner.data.items)) return inner as OkxResponse;
    }
  } catch {
    // ignore
  }
  return j as OkxResponse;
}
