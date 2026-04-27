import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ohlarr — Private payment rails for autonomous agents',
  description:
    'Drop-in x402 middleware that settles AI agent payments inside MagicBlock Private Ephemeral Rollups. Encrypted by default, verifiable when needed.',
  metadataBase: new URL('https://ohlarr.com'),
  openGraph: {
    title: 'Ohlarr',
    description: 'Private payment rails for autonomous agents.',
    url: 'https://ohlarr.com',
    siteName: 'Ohlarr',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  );
}
