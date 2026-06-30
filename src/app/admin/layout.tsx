import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ApexHub Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`dark ${geist.variable} antialiased`}>
      <body className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/60">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
            <a href="/admin" className="font-bold tracking-tight">
              Apex<span className="text-primary">Hub</span>{" "}
              <span className="text-muted-foreground">Admin</span>
            </a>
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← на сайт
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
