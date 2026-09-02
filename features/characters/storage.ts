import type { Character } from "./types";

const STORAGE_KEY = "monde-ia-custom-characters";

function isStoredCharacter(value: unknown): value is Character {
  if (!value || typeof value !== "object") return false;
  const character = value as Partial<Character>;
  return Boolean(
    character.isCustom &&
    character.id &&
    character.name &&
    Number.isFinite(character.lng) &&
    Number.isFinite(character.lat),
  );
}

export function loadLocalCharacters(): Character[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isStoredCharacter) : [];
  } catch {
    return [];
  }
}

export function saveLocalCharacters(characters: Character[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}
