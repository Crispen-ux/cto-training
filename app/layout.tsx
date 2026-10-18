import type { Metadata } from "next";
import Link from "next/link";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal CTO Academy",
  description: "Learn the framework. Build real systems. Defend your decisions. Prove your competence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Personal CTO Academy</Link>
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/diagnostic">Baseline</Link>
            <Link href="/roadmap">Roadmap</Link>
            <Link href="/evidence">Evidence</Link>
            <Link href="/review">Review</Link>
            <Link href="/ai-log">AI log</Link>
            <Link href="/sources">Sources</Link>
            <Link href="/settings">Settings</Link>
            <details className="dropdown">
              <summary>Tools</summary>
              <div className="dropdown-menu">
                <Link href="/architecture">Architecture report</Link>
                <Link href="/articulation">Executive communication</Link>
                <Link href="/decision">Decision loop</Link>
                <Link href="/adr">ADR generator</Link>
                <Link href="/c4">C4 diagrams</Link>
              </div>
            </details>
          </nav>
        </header>
        <main>{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
