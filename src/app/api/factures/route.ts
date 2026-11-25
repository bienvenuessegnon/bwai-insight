import { readLimitedJson } from "@/server/body";
import { requestOrigin, runBilling } from "@/server/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await runBilling({ state: null, action: null }, requestOrigin(request));
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ state: result.state, view: result.view });
}

export async function POST(request: Request) {
  const body = await readLimitedJson(request);
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status });
  const record = body.value && typeof body.value === "object" ? (body.value as { state?: unknown; action?: unknown }) : {};
  const result = await runBilling({ state: record.state ?? null, action: record.action ?? null }, requestOrigin(request));
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ state: result.state, view: result.view });
}
