import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Any domain starting with "tapza." is allowed (tapza.com, tapza.in, tapza.io, ...).
const isTapzaDomain = (d) => typeof d === "string" && /^tapza\.[a-z.]+$/i.test(d);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email_verified) return false;

      const email = (profile.email || "").toLowerCase();
      const emailDomain = email.split("@")[1] || "";
      const hd = profile.hd;

      // Accept only Tapza Google Workspace accounts — either via the hd claim
      // (set for Workspace users) or by the email's domain as a fallback.
      const matchesDomain = isTapzaDomain(hd) || isTapzaDomain(emailDomain);

      if (!matchesDomain) {
        return `/auth/error?error=DomainRestricted`;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/auth/error",
  },
  session: { strategy: "jwt" },
});
