import { runBilling, requestOrigin } from "@/server/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await runBilling({ state: null, action: null }, requestOrigin(request));
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
  const result = await runBilling({ state: record.state ?? null, action: record.action ?? null }, requestOrigin(request));
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ state: result.state, view: result.view });
}
