import Link from "next/link";

export default async function AuthErrorPage({ searchParams }) {
  const params = (await searchParams) || {};
  const error = params.error;
  const isDomainError = error === "DomainRestricted";

  return (
    <main style={{
      minHeight: "100vh", width: "100vw", display: "flex",
      backgroundColor: "var(--color-bg-body)",
      position: "fixed", inset: 0, zIndex: 50,
    }}>
      {/* Left — Error card */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "48px 32px",
        backgroundColor: "var(--color-bg-surface)",
        maxWidth: "520px", minWidth: "400px",
      }}>
        <div style={{ width: "100%", maxWidth: "340px", textAlign: "center" }}>
          {/* Lock icon */}
          <div style={{
            width: "52px", height: "52px", borderRadius: "14px",
            backgroundColor: "color-mix(in srgb, #ef4444 8%, var(--color-bg-surface))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 style={{
            fontSize: "1.3rem", fontWeight: "800", color: "var(--color-text-main)",
            marginBottom: "8px", letterSpacing: "-0.02em",
          }}>
            {isDomainError ? "Access Restricted" : "Sign-in Failed"}
          </h1>

          <p style={{
            fontSize: "0.85rem", color: "var(--color-text-muted)",
            lineHeight: 1.6, marginBottom: "24px",
          }}>
            {isDomainError
              ? "This workspace is only available for Tapza organization members."
              : "Something went wrong. Please try again."}
          </p>

          {isDomainError && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px", borderRadius: "10px", marginBottom: "24px",
              backgroundColor: "color-mix(in srgb, #ef4444 5%, var(--color-bg-body))",
              border: "1px solid color-mix(in srgb, #ef4444 12%, var(--color-border))",
              fontSize: "0.75rem", fontWeight: "600", color: "var(--color-text-muted)",
              justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              Allowed: @tapza.in
            </div>
          )}

          <Link href="/signin" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "13px", borderRadius: "10px",
            backgroundColor: "var(--color-bg-body)", color: "var(--color-text-main)",
            border: "1.5px solid var(--color-border)",
            fontSize: "0.85rem", fontWeight: "700", textDecoration: "none",
          }}>
            Back to sign in
          </Link>

          <p style={{ marginTop: "16px", fontSize: "0.7rem", color: "var(--color-text-light)" }}>
            Try with a different account
          </p>
        </div>
      </div>

      {/* Right — Illustration */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, var(--color-bg-body) 0%, color-mix(in srgb, #2563eb 6%, var(--color-bg-body)) 100%)",
      }}>
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px", textAlign: "center" }}>
          <img
            src="/secure-server.svg"
            alt="Secure server illustration"
            style={{ width: "100%", maxWidth: "360px", margin: "0 auto", display: "block" }}
          />
          <h2 style={{ fontSize: "1rem", fontWeight: "800", color: "var(--color-text-main)", marginTop: "24px", letterSpacing: "-0.02em" }}>
            Your data is protected
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
            Only authorized Tapza members can access this workspace
          </p>
        </div>
      </div>
    </main>
  );
}
