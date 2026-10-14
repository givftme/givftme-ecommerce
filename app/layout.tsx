import type { Metadata } from "next";
import { Inter, Belleza } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DEFAULT_OG_IMAGE, SITE_NAME, TWITTER_HANDLE } from "@/lib/seo/metadata";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const belleza = Belleza({
  variable: "--font-belleza-src",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Givftme — The Gift Museum",
    template: "%s — Givftme",
  },
  description:
    "Curate your wishlist, share it with loved ones, and never receive the wrong gift again. Browse the Givftme gift museum for every occasion.",
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
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
      suppressHydrationWarning
      className={`${inter.variable} ${belleza.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
