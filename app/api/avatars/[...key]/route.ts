import { getBucket } from "@/db";

export const runtime = "edge";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await context.params;
  const key = segments.map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "")).filter(Boolean).join("/");
  if (!key.startsWith("characters/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await getBucket().get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
