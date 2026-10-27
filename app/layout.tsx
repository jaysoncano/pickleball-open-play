import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Suspense } from "react";
import { Backdrop } from "@/components/backdrop";
import { SiteNav, SiteNavShell } from "@/components/site-nav";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "POP · Pickleball Open Play", template: "%s · POP" },
  description:
    "Pickleball open play: fair court rotation, recorded matches, player history, and skill levels you can protest.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fffaf2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Backdrop />
        <Suspense fallback={<SiteNavShell />}>
          <SiteNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
