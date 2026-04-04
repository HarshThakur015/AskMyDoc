import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskMyDoc — Document Intelligence",
  description: "Ask questions about your documents. Powered by retrieval-augmented generation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
