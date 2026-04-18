import './globals.css';
import { Inter } from 'next/font/google';
import { auth } from '@/auth';
import { AuthProvider } from './components/AuthProvider';
import NextAuthSessionProvider from './components/NextAuthSessionProvider';
import AppShell from './components/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Tapza Internal Portal',
  description: 'Premium Bug Tracking for the Team',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  const defaultSettings = {
    assignees: ["Rohith", "Tapza Admin", "Engineering Team"]
  };

  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <NextAuthSessionProvider session={session}>
          <AuthProvider settings={defaultSettings}>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}

