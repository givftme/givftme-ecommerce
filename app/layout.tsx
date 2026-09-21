import type { Metadata } from "next";
import { Inter, Belleza } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const belleza = Belleza({
  variable: "--font-belleza-src",
  weight: "400",
  subsets: ["latin"],
});

const description =
  "Discover Givftme, the gifting platform that helps you remember important moments, create wishlist, and find thoughtful gifts, and celebrate the people who matter.";

export const metadata: Metadata = {
  // Social crawlers need absolute URLs for the generated opengraph-image.
  metadataBase: new URL(process.env.NEXT_APP_URL ?? "http://localhost:3000"),
  title: "Givftme",
  description,
  openGraph: {
    title: "Givftme",
    description,
    siteName: "Givftme",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Givftme",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${belleza.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
