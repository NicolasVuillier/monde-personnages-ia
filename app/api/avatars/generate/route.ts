import { getBucket } from "@/db";
import { errorResponse, requireWebMcpAdmin } from "@/server/authorization";
import { findRemoteCharacter, setGeneratedAvatar } from "@/server/characters";
import { buildHistoricalAvatarPrompt, generateFluxAvatar } from "@/server/flux";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    requireWebMcpAdmin(request);
    const body = await request.json() as { id?: unknown; visualDescription?: unknown };
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    const visualDescription = typeof body.visualDescription === "string"
      ? body.visualDescription.trim().slice(0, 800)
      : "";
    if (!id) return Response.json({ error: "Précise le personnage à illustrer." }, { status: 400 });

    const character = await findRemoteCharacter(id);
    if (!character) return Response.json({ error: "Crée d’abord le brouillon du personnage." }, { status: 404 });

    const prompt = buildHistoricalAvatarPrompt(
      character.name,
      character.subtitle,
      character.description,
      visualDescription,
    );
    const generated = await generateFluxAvatar(prompt);
    const extension = generated.contentType.includes("png") ? "png" : generated.contentType.includes("webp") ? "webp" : "jpg";
    const key = `characters/${character.id}/${crypto.randomUUID()}.${extension}`;
    await getBucket().put(key, generated.bytes, {
      httpMetadata: { contentType: generated.contentType, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { characterId: character.id, provider: "flux-2-klein-9b" },
    });

    const avatar = `/api/avatars/${key}`;
    await setGeneratedAvatar(character.id, avatar, prompt, generated.provider);
    return Response.json({
      characterId: character.id,
      avatar,
      provider: generated.provider,
      costCredits: generated.costCredits,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "La demande d’avatar est invalide." }, { status: 400 });
    }
    if (error instanceof Error && (error.message.includes("clé AI/ML API") || error.message.includes("clé Black Forest Labs"))) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof Error && error.message.startsWith("FLUX")) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return errorResponse(error);
  }
}
