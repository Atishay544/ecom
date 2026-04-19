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
    default: "Layers Factory — Premium Marble Temples & Spiritual Decor India",
    template: "%s | Layers Factory",
  },
  description: "Buy premium handcrafted marble temples, divine sculptures (Ganesh, Lakshmi, Shiva) and spiritual home decor online. Free shipping above ₹499. Trusted by thousands across India. Shop layerfactory.in",
  keywords: [
    "marble temple", "marble mandir", "home temple online india", "buy marble mandir",
    "marble ganesh statue", "marble lakshmi idol", "marble shiva idol",
    "spiritual home decor india", "pooja room decor", "divine sculptures india",
    "handcrafted marble products", "layers factory", "layerfactory.in",
    "ganishka collection", "marble deity india", "buy marble temple online india",
    "best marble temple website india", "online spiritual store india",
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

// Organization + WebSite + OnlineStore JSON-LD
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "OnlineStore"],
      "@id": `${BASE_URL}/#organization`,
      name: "Layers Factory",
      alternateName: ["LayerFactory", "Ganishka Collection"],
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
      },
      description: "India's trusted online store for premium handcrafted marble temples, divine deity sculptures (Ganesh, Lakshmi, Shiva, Durga, Krishna), and spiritual home decor. Free shipping above ₹499. Pan-India delivery.",
      founder: { "@type": "Person", name: "Atishay Jain" },
      foundingDate: "2024",
      areaServed: {
        "@type": "Country",
        name: "India",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: "support@aitalk247.com",
          contactType: "customer support",
          availableLanguage: ["English", "Hindi"],
          areaServed: "IN",
        },
        {
          "@type": "ContactPoint",
          email: "orders@aitalk247.com",
          contactType: "sales",
          availableLanguage: ["English", "Hindi"],
          areaServed: "IN",
        },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Marble Temples & Spiritual Decor",
        itemListElement: [
          { "@type": "OfferCatalog", name: "Marble Temples & Mandirs" },
          { "@type": "OfferCatalog", name: "Divine Sculptures" },
          { "@type": "OfferCatalog", name: "Spiritual Home Decor" },
          { "@type": "OfferCatalog", name: "Pooja Accessories" },
        ],
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "Layers Factory",
      description: "Buy premium handcrafted marble temples, divine sculptures and spiritual decor online in India.",
      inLanguage: "en-IN",
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
