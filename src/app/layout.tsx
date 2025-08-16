import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "推しスポNavi",
  description: "推しスポットナビゲーションアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50`}>{children}</body>
    </html>
  );
}
