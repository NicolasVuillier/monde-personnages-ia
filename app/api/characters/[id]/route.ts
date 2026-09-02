import { errorResponse, requireWebMcpAdmin } from "@/server/authorization";
import { findRemoteCharacter, replaceRemoteCharacter } from "@/server/characters";
import type { Category, RemoteCharacter, ResponseLength } from "@/features/characters/types";

export const runtime = "edge";

const CATEGORIES: Category[] = ["Histoire", "Mythes", "Fiction", "Créations"];

type CharacterPatch = Partial<RemoteCharacter> & {
  relationChanges?: unknown;
};

type RelationChange = {
  targetId: string;
  action: "add" | "remove" | "set_strength";
  strength?: number;
};

function cleanText(value: unknown, maxLength: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

function cleanNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

function cleanResponseLength(value: unknown): ResponseLength | undefined {
  return value === "courte" || value === "standard" || value === "developpee" ? value : undefined;
}

function cleanRelationId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanStrength(value: unknown): number | undefined {
  const strength = typeof value === "number" ? value : Number(value);
  return Number.isFinite(strength) ? Math.min(1, Math.max(0.2, strength)) : undefined;
}

function cleanRelationChanges(value: unknown): RelationChange[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 60).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const targetId = cleanRelationId(candidate.targetId);
    const action = candidate.action;
    if (!targetId || (action !== "add" && action !== "remove" && action !== "set_strength")) return [];
    return [{ targetId, action, strength: cleanStrength(candidate.strength) }];
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireWebMcpAdmin(request);
    const { id } = await context.params;
    const current = await findRemoteCharacter(id);
    if (!current) return Response.json({ error: "Personnage introuvable." }, { status: 404 });

    const body = await request.json() as CharacterPatch;
    const categoryInput = cleanText(body.category, 20) as Category | undefined;
    let relations = Array.isArray(body.relations)
      ? [...new Set(body.relations.map(cleanRelationId).filter(Boolean))].slice(0, 30)
      : [...current.relations];
    const relationStrengths: Record<string, number> = { ...current.relationStrengths };

    if (Array.isArray(body.relations)) {
      Object.keys(relationStrengths).forEach((targetId) => {
        if (!relations.includes(targetId)) delete relationStrengths[targetId];
      });
    }

    for (const change of cleanRelationChanges(body.relationChanges)) {
      if (change.action === "remove") {
        relations = relations.filter((targetId) => targetId !== change.targetId);
        delete relationStrengths[change.targetId];
        continue;
      }
      if (change.action === "add" && !relations.includes(change.targetId) && relations.length < 30) {
        relations.push(change.targetId);
      }
      if (relations.includes(change.targetId) && change.strength !== undefined) {
        relationStrengths[change.targetId] = change.strength;
      }
    }

    Object.keys(relationStrengths).forEach((targetId) => {
      if (!relations.includes(targetId)) delete relationStrengths[targetId];
    });

    const updated: RemoteCharacter = {
      ...current,
      name: cleanText(body.name, 100) || current.name,
      subtitle: cleanText(body.subtitle, 180) || current.subtitle,
      category: categoryInput && CATEGORIES.includes(categoryInput) ? categoryInput : current.category,
      location: cleanText(body.location, 180) || current.location,
      era: cleanText(body.era, 120) || current.era,
      lng: cleanNumber(body.lng, -180, 180) ?? current.lng,
      lat: cleanNumber(body.lat, -90, 90) ?? current.lat,
      color: /^#[0-9a-f]{6}$/i.test(cleanText(body.color, 12) ?? "") ? String(body.color) : current.color,
      description: cleanText(body.description, 2_000) || current.description,
      greeting: cleanText(body.greeting, 500) || current.greeting,
      reply: cleanText(body.reply, 500) || current.reply,
      relations,
      relationStrengths,
      responseLength: cleanResponseLength(body.responseLength) ?? current.responseLength,
    };

    await replaceRemoteCharacter(updated);
    return Response.json({ character: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
