import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "North Star",
  description: "Production-shaped AI mental health product for emotionally overloaded professionals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
