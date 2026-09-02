import { errorResponse, requireWebMcpAdmin } from "@/server/authorization";
import { publishRemoteCharacters } from "@/server/characters";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    requireWebMcpAdmin(request);
    const body = await request.json() as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 100)))].slice(0, 20)
      : [];
    if (ids.length === 0) return Response.json({ error: "Aucun personnage à publier." }, { status: 400 });

    await publishRemoteCharacters(ids);
    return Response.json({ published: ids });
  } catch (error) {
    return errorResponse(error);
  }
}
