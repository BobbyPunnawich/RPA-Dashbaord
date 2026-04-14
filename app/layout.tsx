import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPA Admin Control Center",
  description: "Professional RPA monitoring and management hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm px-6 py-3.5">
          <div className="max-w-screen-xl mx-auto flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-white">
              RPA Control Center
            </span>
            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
              Live
            </span>
          </div>
        </header>
        <main className="max-w-screen-xl mx-auto px-6 py-7">{children}</main>
      </body>
    </html>
  );
}
