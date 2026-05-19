import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F4B5A0',
};

export const metadata: Metadata = {
  title: 'רשימת קניות',
  description: 'רשימת קניות משותפת בזמן אמת עם סנכרון עוה״ד',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'רשימת קניות',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { rel: 'icon', type: 'image/svg+xml', url: '/logo.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/icons/icon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/icons/icon-16.png' },
    ],
    apple: [
      { rel: 'apple-touch-icon', sizes: '180x180', url: '/icons/icon-180.png' },
      { rel: 'apple-touch-icon', sizes: '167x167', url: '/icons/icon-167.png' },
      { rel: 'apple-touch-icon', sizes: '152x152', url: '/icons/icon-152.png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="msapplication-TileColor" content="#F4B5A0" />
        <meta name="msapplication-TileImage" content="/icons/icon-152.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
