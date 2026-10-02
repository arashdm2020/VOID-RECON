import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "REDLINE / CTF Operations",
  description: "Live telemetry for a cybersecurity simulation",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
