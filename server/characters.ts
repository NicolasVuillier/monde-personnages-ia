import { getDb } from "@/db";
import type { Category, Character, RemoteCharacter, ResponseLength } from "@/features/characters/types";

type CharacterRow = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  location: string;
  era: string;
  lng: number;
  lat: number;
  color: string;
  avatar: string;
  popularity: number;
  description: string;
  greeting: string;
  reply: string;
  relations: string;
  relation_strengths: string;
  response_length: string;
  status: string;
  owner_email: string;
  avatar_prompt: string | null;
  avatar_provider: string | null;
  created_at: string;
  updated_at: string;
};

export type NewRemoteCharacter = Omit<RemoteCharacter, "isRemote"> & {
  ownerEmail: string;
};

const SELECT_COLUMNS = `
  id, name, subtitle, category, location, era, lng, lat, color, avatar,
  popularity, description, greeting, reply, relations, relation_strengths,
  response_length, status, owner_email,
  avatar_prompt, avatar_provider, created_at, updated_at
`;

function parseRelations(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseRelationStrengths(value: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
        .map(([id, strength]) => [id, Math.min(1, Math.max(0.2, strength))]),
    );
  } catch {
    return {};
  }
}

function parseResponseLength(value: string): ResponseLength {
  return value === "courte" || value === "developpee" ? value : "standard";
}

function rowToCharacter(row: CharacterRow): RemoteCharacter {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    category: row.category as Category,
    location: row.location,
    era: row.era,
    lng: row.lng,
    lat: row.lat,
    color: row.color,
    avatar: row.avatar,
    popularity: row.popularity,
    description: row.description,
    greeting: row.greeting,
    reply: row.reply,
    relations: parseRelations(row.relations),
    relationStrengths: parseRelationStrengths(row.relation_strengths),
    responseLength: parseResponseLength(row.response_length),
    status: row.status === "published" ? "published" : "draft",
    isRemote: true,
    isCustom: true,
  };
}

export async function listRemoteCharacters(includeDrafts: boolean): Promise<RemoteCharacter[]> {
  const db = getDb();
  const statement = includeDrafts
    ? db.prepare(`SELECT ${SELECT_COLUMNS} FROM characters ORDER BY updated_at DESC`)
    : db.prepare(`SELECT ${SELECT_COLUMNS} FROM characters WHERE status = ? ORDER BY updated_at DESC`).bind("published");
  const result = await statement.all<CharacterRow>();
  return result.results.map(rowToCharacter);
}

export async function findRemoteCharacter(id: string): Promise<RemoteCharacter | null> {
  const row = await getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM characters WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<CharacterRow>();
  return row ? rowToCharacter(row) : null;
}

export async function insertRemoteCharacters(characters: NewRemoteCharacter[]): Promise<void> {
  const db = getDb();
  const statements = characters.map((character) => db.prepare(`
    INSERT INTO characters (
      id, name, subtitle, category, location, era, lng, lat, color, avatar,
      popularity, description, greeting, reply, relations, relation_strengths,
      response_length, status, owner_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    character.id,
    character.name,
    character.subtitle,
    character.category,
    character.location,
    character.era,
    character.lng,
    character.lat,
    character.color,
    character.avatar,
    character.popularity,
    character.description,
    character.greeting,
    character.reply,
    JSON.stringify(character.relations),
    JSON.stringify(character.relationStrengths),
    character.responseLength,
    character.status,
    character.ownerEmail,
  ));
  await db.batch(statements);
}

export async function replaceRemoteCharacter(
  character: Character & { status: "draft" | "published" },
): Promise<void> {
  await getDb().prepare(`
    UPDATE characters SET
      name = ?, subtitle = ?, category = ?, location = ?, era = ?, lng = ?, lat = ?,
      color = ?, avatar = ?, popularity = ?, description = ?, greeting = ?, reply = ?,
      relations = ?, relation_strengths = ?, response_length = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    character.name,
    character.subtitle,
    character.category,
    character.location,
    character.era,
    character.lng,
    character.lat,
    character.color,
    character.avatar,
    character.popularity,
    character.description,
    character.greeting,
    character.reply,
    JSON.stringify(character.relations),
    JSON.stringify(character.relationStrengths ?? {}),
    character.responseLength ?? "standard",
    character.status,
    character.id,
  ).run();
}

export async function publishRemoteCharacters(ids: string[]): Promise<void> {
  const db = getDb();
  await db.batch(ids.map((id) => db.prepare(`
    UPDATE characters SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind("published", id)));
}

export async function setGeneratedAvatar(
  id: string,
  avatar: string,
  prompt: string,
  provider: string,
): Promise<void> {
  await getDb().prepare(`
    UPDATE characters SET avatar = ?, avatar_prompt = ?, avatar_provider = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(avatar, prompt, provider, id).run();
}
