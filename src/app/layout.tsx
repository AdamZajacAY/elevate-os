import type { Metadata } from "next";
import { Merriweather } from "next/font/google";
import "./globals.css";

const merriweather = Merriweather({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700", "900"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ELEVATE OS — AdviseYou",
  description:
    "Platforma pracy projektowej, finansow operacyjnych i relacji z klientami zespolu doradczego AdviseYou.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={merriweather.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
