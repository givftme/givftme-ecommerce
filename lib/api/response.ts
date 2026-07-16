import { NextResponse } from "next/server";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
