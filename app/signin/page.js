import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default async function SignInPage({ searchParams }) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = (await searchParams) || {};
  const error = params.error;

  return (
    <main style={{
      minHeight: "100vh", width: "100vw", display: "flex",
      position: "fixed", inset: 0, zIndex: 50,
      backgroundColor: "var(--color-bg-body)",
      fontFamily: 'var(--font-family)',
    }}>

      {/* Left — Login Form */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "48px 32px",
        backgroundColor: "var(--color-bg-surface)", position: "relative", zIndex: 2,
        maxWidth: "520px", minWidth: "400px",
      }}>
        <div style={{ width: "100%", maxWidth: "340px" }}>
          {/* Logo + Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px", justifyContent: "center" }}>
            <img src="/tapzaLogo.png" alt="Tapza" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
            <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--color-text-main)", letterSpacing: "-0.02em" }}>Tapza Bug Portal</span>
          </div>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "10px", backgroundColor: "#fef2f2",
              border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.8rem",
              fontWeight: "600", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              {error === "DomainRestricted"
                ? "Only Tapza accounts are allowed."
                : "Sign-in failed. Please try again."}
            </div>
          )}

          {/* Google Sign In — opens in popup */}
          <GoogleSignInButton />

          <p style={{ marginTop: "28px", fontSize: "0.75rem", color: "var(--color-text-light)", textAlign: "center", paddingRight: "16px" }}>
            Sign in with your Tapza work email
          </p>
        </div>
      </div>

      {/* Right — Illustration panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 40px", position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, var(--color-bg-body) 0%, color-mix(in srgb, #2563eb 6%, var(--color-bg-body)) 100%)",
      }}>
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "480px", textAlign: "center" }}>
          <img
            src="/bug-fixing-cuate.svg"
            alt="Bug fixing illustration"
            style={{ width: "100%", maxWidth: "400px", margin: "0 auto", display: "block" }}
          />

          <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--color-text-main)", marginTop: "28px", letterSpacing: "-0.02em" }}>
            Bug tracking for your ERP products
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "20px" }}>
            Report, track, and resolve bugs across all four platforms
          </p>

          {/* Product strip */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "16px", marginTop: "32px",
          }}>
            {[
              { name: "Pharmacy", icon: "Rx", color: "#2563eb" },
              { name: "Clinic", icon: "+", color: "#10b981" },
              { name: "Laboratory", icon: "Lab", color: "#8b5cf6" },
              { name: "Hospital", icon: "H", color: "#f59e0b" },
            ].map(p => (
              <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  backgroundColor: `${p.color}12`, border: `1.5px solid ${p.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.8rem", fontWeight: "900", color: p.color,
                }}>{p.icon}</div>
                <span style={{ fontSize: "0.6rem", fontWeight: "700", color: "var(--color-text-main)" }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
