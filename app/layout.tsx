import "./globals.css";

export const metadata = {
  title: "OKX 挂单筛选 · sats 阈值（Vercel）",
  description: "Serverless proxy + fast + stable"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
