import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ganishka Collection", template: "%s | Ganishka Collection" },
  description: "Shop the best products at the best prices. Free shipping on orders above ₹499.",
  keywords: ["ecommerce", "shop", "online store", "buy online", "ganishka collection"],
  authors: [{ name: "Atishay Jain" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "Ganishka Collection",
    title: "Ganishka Collection",
    description: "Shop the best products at the best prices.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ganishka Collection",
    description: "Shop the best products at the best prices.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
