import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { userStates } from "@/db/schema";

async function userId() {
  return (await headers()).get("oai-authenticated-user-id");
}

export async function GET(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "Sign-in required" }, { status: 401 });
  const season = new URL(request.url).searchParams.get("season") || "2026/27";
  try {
    const row = await getDb().query.userStates.findFirst({
      where: and(eq(userStates.userId, id), eq(userStates.season, season)),
    });
    return Response.json({ state: row ? JSON.parse(row.stateJson) : null });
  } catch {
    return Response.json({ error: "We couldn't load your data" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "Sign-in required" }, { status: 401 });
  try {
    const payload = (await request.json()) as { season?: string; state?: unknown };
    if (!payload.season || !payload.state) {
      return Response.json({ error: "Missing data to save" }, { status: 400 });
    }
    const db = getDb();
    await db
      .insert(userStates)
      .values({ userId: id, season: payload.season, stateJson: JSON.stringify(payload.state) })
      .onConflictDoUpdate({
        target: [userStates.userId, userStates.season],
        set: { stateJson: JSON.stringify(payload.state), updatedAt: new Date().toISOString() },
      });
    return Response.json({ ok: true, savedAt: new Date().toISOString() });
  } catch {
    return Response.json({ error: "Save failed. Please try again." }, { status: 500 });
  }
}
