import { errorResponse, requireWebMcpAdmin } from "@/server/authorization";
import { insertRemoteCharacters, listRemoteCharacters, type NewRemoteCharacter } from "@/server/characters";
import type { Category, ResponseLength } from "@/features/characters/types";

export const runtime = "edge";

const CATEGORIES: Category[] = ["Histoire", "Mythes", "Fiction", "Créations"];
const COLORS = ["#58e6bd", "#72a7ff", "#ff73c7", "#ffb45c", "#b68cff", "#d4ff68"];

type CharacterInput = {
  name?: unknown;
  subtitle?: unknown;
  category?: unknown;
  location?: unknown;
  era?: unknown;
  lng?: unknown;
  lat?: unknown;
  color?: unknown;
  description?: unknown;
  greeting?: unknown;
  reply?: unknown;
  relations?: unknown;
  responseLength?: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanCoordinate(value: unknown, min: number, max: number): number | null {
  const coordinate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

function cleanResponseLength(value: unknown): ResponseLength {
  return value === "courte" || value === "developpee" ? value : "standard";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "personnage";
}

function toCharacter(input: CharacterInput, ownerEmail: string, index: number): NewRemoteCharacter {
  const name = cleanText(input.name, 100);
  const subtitle = cleanText(input.subtitle, 180);
  const location = cleanText(input.location, 180);
  const description = cleanText(input.description, 2_000);
  const lng = cleanCoordinate(input.lng, -180, 180);
  const lat = cleanCoordinate(input.lat, -90, 90);

  if (!name || !subtitle || !location || !description || lng === null || lat === null) {
    throw new Error(`Le personnage ${index + 1} doit avoir un nom, un rôle, un lieu, une description et des coordonnées valides.`);
  }

  const requestedCategory = cleanText(input.category, 20) as Category;
  const category = CATEGORIES.includes(requestedCategory) ? requestedCategory : "Créations";
  const colorCandidate = cleanText(input.color, 12);
  const color = /^#[0-9a-f]{6}$/i.test(colorCandidate) ? colorCandidate : COLORS[index % COLORS.length];
  const relations = Array.isArray(input.relations)
    ? input.relations.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 30)
    : [];
  const id = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const avatarSeed = encodeURIComponent(`${name}-${subtitle}`);

  return {
    id,
    name,
    subtitle,
    category,
    location,
    era: cleanText(input.era, 120) || "Créé avec un agent",
    lng,
    lat,
    color,
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${avatarSeed}`,
    popularity: 0.7,
    description,
    greeting: cleanText(input.greeting, 500) || `Bonjour, je suis ${name}. Que veux-tu découvrir avec moi ?`,
    reply: cleanText(input.reply, 500) || "Raconte-m’en davantage : je veux comprendre ce qui t’amène jusqu’ici.",
    relations,
    relationStrengths: {},
    responseLength: cleanResponseLength(input.responseLength),
    status: "published",
    ownerEmail,
  };
}

export async function GET() {
  try {
    const characters = await listRemoteCharacters();
    return Response.json({ characters });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerEmail = requireWebMcpAdmin(request);
    const body = await request.json() as { characters?: unknown };
    if (!Array.isArray(body.characters) || body.characters.length === 0 || body.characters.length > 20) {
      return Response.json({ error: "Envoie entre 1 et 20 personnages par lot." }, { status: 400 });
    }

    const characters = body.characters.map((input, index) => toCharacter(input as CharacterInput, ownerEmail, index));
    await insertRemoteCharacters(characters);
    return Response.json({ characters }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Le lot de personnages est invalide." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Le personnage")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
