"use client";
import { SessionProvider } from "next-auth/react";

export default function NextAuthSessionProvider({ children, session }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
