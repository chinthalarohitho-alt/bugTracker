import Link from "next/link";

export default async function AuthErrorPage({ searchParams }) {
  const params = (await searchParams) || {};
  const error = params.error;
  const isDomainError = error === "DomainRestricted";

  return (
    <main style={{
      minHeight: "100vh", width: "100vw",
      display: "grid", gridTemplateColumns: "1fr 1fr",
      fontFamily: "var(--font-family)",
      backgroundColor: "#ffffff"
    }}>
      {/* LEFT — Illustration panel */}
      <div style={{
        backgroundColor: "#f1f5f9",
        padding: "48px 40px",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 36,
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 24,
          width: "100%", maxWidth: 420
        }}>
          <svg
            viewBox="0 0 320 280"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ width: "100%", maxWidth: 320, display: "block" }}
          >
            {/* Soft ground shadow */}
            <ellipse cx="160" cy="248" rx="110" ry="8" fill="#0f172a" opacity="0.06" />

            {/* Decorative dots */}
            <circle cx="58" cy="60" r="3" fill="#cbd5e1" />
            <circle cx="278" cy="80" r="3" fill="#cbd5e1" />
            <circle cx="46" cy="180" r="2.5" fill="#facc15" opacity="0.8" />
            <circle cx="282" cy="200" r="2.5" fill="#facc15" opacity="0.8" />
            <circle cx="80" cy="38" r="2" fill="#e2e8f0" />
            <circle cx="252" cy="42" r="2" fill="#e2e8f0" />

            {/* Dashed perimeter ring */}
            <circle cx="160" cy="140" r="116" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.7" />

            {/* Shield body */}
            <path
              d="M160 40 L235 70 L235 145 C235 188 200 222 160 232 C120 222 85 188 85 145 L85 70 Z"
              fill="#0f172a"
            />
            {/* Shield highlight */}
            <path
              d="M160 40 L235 70 L235 145 C235 188 200 222 160 232 C120 222 85 188 85 145 L85 70 Z"
              fill="url(#shieldGrad)"
              opacity="0.18"
            />
            <defs>
              <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Yellow accent badge at top of shield */}
            <circle cx="160" cy="70" r="14" fill="#facc15" />
            <path d="M154 70 L158 74 L167 65" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Padlock body */}
            <rect x="128" y="138" width="64" height="52" rx="8" fill="#facc15" />
            {/* Padlock shackle */}
            <path
              d="M138 138 L138 122 C138 110 148 100 160 100 C172 100 182 110 182 122 L182 138"
              stroke="#facc15"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />
            {/* Keyhole */}
            <circle cx="160" cy="158" r="5" fill="#0f172a" />
            <rect x="158" y="160" width="4" height="14" rx="1.5" fill="#0f172a" />
          </svg>
          <div>
            <h2 style={{
              fontSize: "1.5rem", fontWeight: 700,
              color: "#0f172a", margin: 0, marginBottom: 8,
              letterSpacing: "-0.02em"
            }}>
              Your data is protected
            </h2>
            <p style={{
              fontSize: "0.88rem", color: "#64748b",
              margin: 0, lineHeight: 1.5, maxWidth: 340, marginInline: "auto"
            }}>
              Only authorized Tapza members can access this workspace.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — Message panel */}
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
            {isDomainError ? "Access restricted" : "Sign-in failed"}
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
            {isDomainError
              ? "This workspace is only available for Tapza organization members."
              : "Something went wrong. Please try again."}
          </p>
        </div>

        {/* Back button — matches GoogleSignInButton style */}
        <Link
          href="/signin"
          style={{
            alignSelf: "center",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
            padding: "9px 20px", borderRadius: 8,
            border: "none",
            backgroundColor: "#0f172a",
            cursor: "pointer",
            fontSize: "0.82rem", fontWeight: 500,
            color: "#ffffff",
            fontFamily: "var(--font-family)",
            transition: "background-color 0.15s",
            boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
            textDecoration: "none"
          }}
        >
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            backgroundColor: "#ffffff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </span>
          Back to sign in
        </Link>

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
