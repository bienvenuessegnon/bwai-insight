const MAX_BODY = 32_000;

export async function readLimitedJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const advertised = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertised) && advertised > MAX_BODY) {
    return { ok: false, status: 413, error: "La demande est trop lourde." };
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return { ok: false, status: 413, error: "La demande est trop lourde." };
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, status: 400, error: "La demande est illisible." };
  }
}
