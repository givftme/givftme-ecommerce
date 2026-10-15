import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api/response";
import { eventContextFromHeaders } from "@/lib/events/context";
import { ANON_ID_COOKIE, CLIENT_EVENTS, SESSION_ID_COOKIE } from "@/lib/events/names";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

const MAX_PROPS_BYTES = 4096;
const ANON_ID_MAX_AGE = 60 * 60 * 24 * 365;

const eventSchema = z.object({
  event: z.enum(CLIENT_EVENTS),
  props: z.record(z.string(), z.unknown()).default({}),
});

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

// Client-side event intake. Fills in the signed-in user, the visitor's
// anonymous and session ids, device, and geo, then writes through the service
// role. Always answers 200 so analytics can never surface as an error.
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });

  try {
    let anonId = readCookie(request, ANON_ID_COOKIE);
    let sessionId = readCookie(request, SESSION_ID_COOKIE);
    const secure = process.env.NODE_ENV === "production";
    if (!anonId) {
      anonId = crypto.randomUUID();
      response.cookies.set(ANON_ID_COOKIE, anonId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: ANON_ID_MAX_AGE });
    }
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      response.cookies.set(SESSION_ID_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", secure, path: "/" });
    }

    const parsed = eventSchema.safeParse(await readJson(request));
    if (!parsed.success || JSON.stringify(parsed.data.props).length > MAX_PROPS_BYTES) return response;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await recordEvent({
      event: parsed.data.event,
      userId: user?.id ?? null,
      anonId,
      sessionId,
      context: eventContextFromHeaders(request.headers),
      props: parsed.data.props,
    });
  } catch (error) {
    console.error("Could not accept client event.", error);
  }

  return response;
}
