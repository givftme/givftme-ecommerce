import type { Metadata } from "next";
import { Inter, Belleza } from "next/font/google";
import { ThemeProvider } from "next-themes";
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

const description =
  "Discover Givftme, the gifting platform that helps you remember important moments, create wishlists, find thoughtful gifts, and celebrate the people who matter.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Givftme",
    template: "%s | Givftme",
  },
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
