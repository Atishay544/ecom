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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.layerfactory.in'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "LayerFactory — Premium Marble & Spiritual Products",
    template: "%s | LayerFactory",
  },
  description: "Shop premium marble temples, divine sculptures and spiritual decor. Free shipping on orders above ₹499. Trusted by thousands across India.",
  keywords: [
    "marble temple", "marble mandir", "home temple", "pooja mandir",
    "marble deity", "spiritual decor", "divine collection", "layerfactory",
    "ganishka collection", "atishay jain", "marble products india",
    "buy marble temple online", "home pooja room", "3D models temple"
  ],
  authors: [{ name: "Atishay Jain", url: BASE_URL }],
  creator: "Atishay Jain",
  publisher: "Ganishka Collection",
  category: "ecommerce",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BASE_URL,
    siteName: "LayerFactory",
    title: "LayerFactory — Premium Marble & Spiritual Products",
    description: "Shop premium marble temples, divine sculptures and spiritual decor. Free shipping on orders above ₹499.",
    images: [
      {
        url: `/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "LayerFactory — Premium Marble & Spiritual Products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LayerFactory — Premium Marble & Spiritual Products",
    description: "Shop premium marble temples, divine sculptures and spiritual decor.",
    images: [`/opengraph-image`],
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your Google Search Console verification token here once you have it
    // google: 'your-verification-token',
  },
};

// Organization + WebSite JSON-LD — helps Google understand your brand
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "LayerFactory",
      alternateName: "Ganishka Collection",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
      },
      founder: {
        "@type": "Person",
        name: "Atishay Jain",
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "atishayjain54@gmail.com",
        contactType: "customer support",
        availableLanguage: ["English", "Hindi"],
        areaServed: "IN",
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "LayerFactory",
      description: "Premium Marble & Spiritual Products",
      publisher: { "@id": `${BASE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
}

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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
