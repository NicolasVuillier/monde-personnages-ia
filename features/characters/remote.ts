import type { RemoteCharacter } from "./types";

type CharacterResponse = {
  characters?: RemoteCharacter[];
  error?: string;
};

export async function loadRemoteCharacters(): Promise<RemoteCharacter[]> {
  const response = await fetch("/api/characters?include=drafts", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const data = await response.json() as CharacterResponse;
  if (!response.ok) throw new Error(data.error || "Les personnages dynamiques ne sont pas disponibles.");
  return Array.isArray(data.characters) ? data.characters : [];
}
