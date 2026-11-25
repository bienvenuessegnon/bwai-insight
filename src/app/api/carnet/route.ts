import { runCarnet } from "@/server/carnet";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = runCarnet({ state: null, action: null });
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ state: result.state, view: result.view });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "La demande est illisible." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as { state?: unknown; action?: unknown }) : {};
  const result = runCarnet({ state: record.state ?? null, action: record.action ?? null });
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ state: result.state, view: result.view });
}
