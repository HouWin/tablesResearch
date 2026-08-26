import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpreadJS 经营数据表 Demo",
  description: "基于 SpreadJS 19.1 的业务表格组件功能验收 Demo。",
  openGraph: {
    title: "SpreadJS 经营数据表 Demo",
    description: "批注、钻取、撤销、行列分组、统计、历史、血缘与附件的一体化演示",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "SpreadJS 经营数据表 Demo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SpreadJS 经营数据表 Demo",
    description: "基于 SpreadJS 19.1 的业务表格组件功能验收 Demo",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
