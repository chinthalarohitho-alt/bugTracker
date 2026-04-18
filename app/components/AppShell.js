"use client";
import { usePathname } from "next/navigation";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import OnboardingScreen from "./OnboardingScreen";
import { useAuth } from "./AuthProvider";
import BugDrawerProvider from "./BugDrawerProvider";

const AUTH_PAGES = ["/signin", "/auth"];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { showOnboarding } = useAuth();
  const isAuthPage = AUTH_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`));

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (showOnboarding) {
    return <OnboardingScreen />;
  }

  return (
    <div className="app-frame">
      <Sidebar />
      <main className="layout-main">
        <BugDrawerProvider>
          <TopNav />
          <div className="page-canvas">
            {children}
          </div>
        </BugDrawerProvider>
      </main>
    </div>
  );
}
