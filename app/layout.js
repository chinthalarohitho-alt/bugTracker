import './globals.css';
import { AuthProvider } from './components/AuthProvider';
import NextAuthSessionProvider from './components/NextAuthSessionProvider';
import AppShell from './components/AppShell';

export const metadata = {
  title: 'Tapza Bug Portal',
  description: 'Premium Bug Tracking for the Team',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
};

export default function RootLayout({ children }) {
  const defaultSettings = {
    assignees: ["Rohith", "Tapza Admin", "Engineering Team"]
  };

  return (
    <html lang="en">
      <body>
        <NextAuthSessionProvider>
          <AuthProvider settings={defaultSettings}>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}

