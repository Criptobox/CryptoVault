import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { PWARegister } from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CryptoVault — Dashboard premium multi-red de carteras",
  description:
    "Dashboard no custodial de diseño premium: todos tus tokens y NFTs en todas las redes, rescate de fondos en contratos viejos en 1 clic, revocación de aprobaciones y alertas de precio. Convertible en APK y app de Windows.",
  keywords: ["wallet", "dashboard", "multichain", "NFT", "rescate", "revoke", "PWA"],
  applicationName: "CryptoVault",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "CryptoVault — Tu portafolio crypto, todas las redes",
    description: "Tokens, NFTs, rescate de contratos viejos y alertas — en una sola app no custodial premium",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#06050c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
