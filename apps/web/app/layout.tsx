import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
