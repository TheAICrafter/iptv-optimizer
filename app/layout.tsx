import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IPTV Optimizer',
  description: 'Filter your IPTV channels and get a clean shareable M3U URL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
