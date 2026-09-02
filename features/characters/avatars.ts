import type { AvatarStyle } from "./types";

export const avatarStyles: Array<{ id: AvatarStyle; label: string }> = [
  { id: "notionists", label: "Portrait" },
  { id: "adventurer", label: "Aventure" },
  { id: "bottts", label: "Robot" },
  { id: "big-smile", label: "Fantaisie" },
  { id: "pixel-art", label: "Pixel" },
  { id: "shapes", label: "Formes" },
];

function avatarBaseName(name: string): string {
  const normalized = name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return normalized || "nouveau-personnage";
}

export function buildAvatarSeed(name: string, batch: number, index: number): string {
  return `${avatarBaseName(name)}-${batch + 1}-${index + 1}`;
}

export function buildAvatarUrl(style: AvatarStyle, seed: string, color: string): string {
  const background = color.replace("#", "");
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${background}`;
}

export function buildAvatarOptions(
  name: string,
  style: AvatarStyle,
  batch: number,
  color: string,
) {
  return Array.from({ length: 6 }, (_, index) => {
    const seed = buildAvatarSeed(name, batch, index);
    return { seed, url: buildAvatarUrl(style, seed, color) };
  });
}
