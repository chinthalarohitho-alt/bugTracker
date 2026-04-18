import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GoogleSignInButton from "../components/GoogleSignInButton";
import SignInCarousel from "../components/SignInCarousel";

export default async function SignInPage({ searchParams }) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = (await searchParams) || {};
  const error = params.error;

  return (
    <main style={{
      minHeight: "100vh", width: "100vw",
      display: "grid", gridTemplateColumns: "1fr 1fr",
      fontFamily: "var(--font-family)",
      backgroundColor: "#ffffff"
    }}>
      {/* LEFT — Illustration carousel */}
      <SignInCarousel />

      {/* RIGHT — Form panel */}
      <div style={{
        padding: "48px 48px",
        display: "flex", flexDirection: "column",
        justifyContent: "center", gap: 28
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tapzaLogo.png" alt="Tapza" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <span style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
            TAPZA <span style={{ color: "#64748b", fontWeight: 600 }}>INTERNAL PORTAL</span>
          </span>
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{
            fontSize: "1.2rem", fontWeight: 600,
            color: "#0f172a", margin: 0, marginBottom: 6,
            letterSpacing: "-0.01em"
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
            Sign in with your Tapza work email to continue.
          </p>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            backgroundColor: "#fef2f2", border: "1px solid #fecaca",
            color: "#b91c1c", fontSize: "0.78rem", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 8
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error === "DomainRestricted" ? "Only Tapza accounts are allowed." : "Sign-in failed. Please try again."}
          </div>
        )}

        {/* Google button */}
        <GoogleSignInButton />

        {/* Helper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>tapza.in accounts only</span>
          <span style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
        </div>
      </div>
    </main>
  );
}
