"use client";

import { useMemo, useState } from "react";

type Result = any;

function fmt(n: any, d = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtAuto(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  const abs = Math.abs(x);
  const d = abs >= 100 ? 2 : abs >= 1 ? 4 : 8;
  return x.toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function Page() {
  const [threshold, setThreshold] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("就绪");
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const warnings = useMemo(() => (data?.warnings ?? []) as string[], [data]);

  async function run() {
    setErr(null);
    setLoading(true);
    setStatus("计算中…");

    try {
      // ✅ 只传 threshold。服务端会根据 OKX 的 count / hasNext 自动拉完所有页
      const q = new URLSearchParams({
        threshold: String(threshold)
      });

      const r = await fetch(`/api/compute?${q.toString()}`, { cache: "no-store" });
      const j = await r.json();

      if (!r.ok) throw new Error(j?.error ?? "Request failed");

      setData(j);
      setStatus("完成");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setStatus("失败");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setThreshold(1000);
    setData(null);
    setErr(null);
    setStatus("就绪");
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ margin: "8px 0" }}>OKX 挂单筛选 · sats 阈值（Vercel 服务器代理版）</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          min={1}
          step={1}
          placeholder="阈值（sats）"
          style={{
            height: 42,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            width: 260
          }}
        />

        <button
          onClick={run}
          disabled={loading}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: "none",
            background: loading ? "#999" : "#1167ff",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700
          }}
        >
          {loading ? "计算中…" : "开始计算"}
        </button>

        <button
          onClick={reset}
          disabled={loading}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700
          }}
        >
          重置
        </button>

        <span style={{ color: "#555" }}>{status}</span>
      </div>

      <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
        说明：本页不再限制最大页数，服务端会按 OKX 返回的 <code>count/hasNext</code> 自动拉取全部页（仍有 <code>deadlineMs</code> 保护，避免平台超时）。
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>
          错误：{err}
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
            <Card label="币安 BTCUSDT" value={data.btcusdt ? `${fmt(data.btcusdt, 2)} USDT` : "-"} />
            <Card label="OKX 总挂单数" value={fmt(data.totalCount)} />
            <Card label="满足条件条数" value={fmt(data.matchedItems)} />
            <Card label="满足条件数量" value={fmt(data.matchedAmount)} />
            <Card label="满足条件 BTC" value={fmtAuto(data.matchedBTC)} />
            <Card label="折合 USD" value={data.matchedUSD ? fmt(data.matchedUSD, 2) : "-"} />
            <Card label="抓取页数" value={fmt(data.pagesFetched)} />
            <Card label="用时" value={`${fmt(data.elapsedMs)} ms`} />
          </div>

          {warnings.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #ffe08a",
                borderRadius: 10,
                background: "#fffaf0"
              }}
            >
              <b>Warnings</b>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {warnings.map((w, i) => (
                  <li key={i} style={{ color: "#7a4b00" }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer" }}>查看前 50 条明细</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {(data.items ?? []).map((it: any, idx: number) => (
                <div key={idx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {it.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.icon}
                          alt="icon"
                          width={26}
                          height={26}
                          style={{ borderRadius: 8, border: "1px solid #eee" }}
                        />
                      ) : null}

                      <b>{it.name}</b>

                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#e8f2ff",
                          color: "#0b57d0",
                          fontWeight: 700
                        }}
                      >
                        {fmt(it.unitSats)} sats
                      </span>
                    </div>

                    <div style={{ color: "#666", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {(it.owner ?? "").slice(0, 12)}…
                    </div>
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap", color: "#444" }}>
                    <span>
                      数量：<b>{fmt(it.amount)}</b>
                    </span>
                    <span>
                      该单需：<b>{fmtAuto(it.totalBTC)} BTC</b>
                    </span>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {it.tokenId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
