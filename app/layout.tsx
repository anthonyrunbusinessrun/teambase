import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TeamBase", template: "%s · TeamBase" },
  description: "Internal company operating system",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#C41230",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
