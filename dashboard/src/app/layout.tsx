import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Cortex Dashboard",
  description: "Shared memory service dashboard for the AI agent team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-muted/30">
            <div className="container py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
