export type Category = "Histoire" | "Mythes" | "Fiction" | "Créations";

export type ResponseLength = "courte" | "standard" | "developpee";

export type AvatarStyle = "notionists" | "adventurer" | "bottts" | "big-smile" | "pixel-art" | "shapes";

export type Character = {
  id: string;
  name: string;
  subtitle: string;
  category: Category;
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
  relations: string[];
  relationStrengths?: Record<string, number>;
  responseLength?: ResponseLength;
  isCustom?: boolean;
  avatarStyle?: AvatarStyle;
  avatarSeed?: string;
  avatarBatch?: number;
  status?: "draft" | "published";
  isRemote?: boolean;
};

export type RemoteCharacter = Character & {
  status: "draft" | "published";
  isRemote: true;
  relationStrengths: Record<string, number>;
  responseLength: ResponseLength;
};

export type CharacterDraft = {
  name: string;
  subtitle: string;
  location: string;
  description: string;
  greeting: string;
  color: string;
  lng: number | null;
  lat: number | null;
  avatarStyle: AvatarStyle;
  avatarSeed: string;
  avatarBatch: number;
};

export type ChatMessage = {
  from: "character" | "user" | "system";
  text: string;
};
