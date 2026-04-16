import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Returns { session } if authenticated, or a NextResponse 401 to return early.
// Use in API route handlers:
//   const gate = await requireAuth();
//   if (gate instanceof NextResponse) return gate;
//   const { session } = gate;
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  return { session };
}
