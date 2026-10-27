import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA Lab",
  description: "A personal NBA season forecasting workspace for team reviews, standings, playoff brackets, awards and player rankings.",
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
    <html lang="en" dir="ltr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
