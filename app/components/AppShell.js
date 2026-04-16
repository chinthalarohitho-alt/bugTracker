"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import OnboardingScreen from "./OnboardingScreen";
import { useAuth } from "./AuthProvider";

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
    <>
      <Sidebar />
      <main className="layout-main">
        <div className="content-container">
          {children}
        </div>
      </main>
    </>
  );
}
