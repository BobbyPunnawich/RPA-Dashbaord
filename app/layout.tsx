import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPA Monitoring Dashboard",
  description: "Real-time monitoring for RPA bots — BBL Report, Pandora Report, and more",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
          <div className="max-w-screen-xl mx-auto flex items-center gap-3">
            <span className="text-2xl font-bold tracking-tight text-white">RPA Monitor</span>
            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">LIVE</span>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
