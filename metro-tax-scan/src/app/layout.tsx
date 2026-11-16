import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metro Tax Scan",
  description:
    "Daily unpaid property-tax and tax-sale opportunity scanner for Fulton, Henry, Cobb, and DeKalb counties.",
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
