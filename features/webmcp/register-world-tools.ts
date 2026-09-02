import type { Character } from "@/features/characters/types";

type ToolCallbacks = {
  getCharacters: () => Character[];
  refreshCharacters: (preferredIds?: string[]) => Promise<void>;
  focusCharacters: (ids: string[]) => void;
  requestPublicationReview: (ids: string[]) => void;
  reportActivity: (message: string) => void;
};

type ApiResult = Record<string, unknown> & { error?: string };

async function callApi(path: string, init: RequestInit): Promise<ApiResult> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await response.json() as ApiResult;
  if (!response.ok) throw new Error(data.error || "L’action demandée a échoué.");
  return data;
}

const characterInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Nom public du personnage, 100 caractères maximum." },
    subtitle: { type: "string", description: "Rôle ou titre précis du personnage." },
    category: { type: "string", enum: ["Histoire", "Mythes", "Fiction", "Créations"] },
    location: { type: "string", description: "Lieu historique ou narratif affiché sur la carte." },
    era: { type: "string", description: "Époque ou période du personnage." },
    lng: { type: "number", minimum: -180, maximum: 180, description: "Longitude exacte du lieu choisi." },
    lat: { type: "number", minimum: -90, maximum: 90, description: "Latitude exacte du lieu choisi." },
    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    description: { type: "string", description: "Identité, connaissances, histoire, limites et manière de parler." },
    greeting: { type: "string", description: "Première phrase prononcée lors d’une rencontre." },
    reply: { type: "string", description: "Exemple bref de réponse dans sa voix." },
    relations: { type: "array", items: { type: "string" }, maxItems: 30 },
    responseLength: {
      type: "string",
      enum: ["courte", "standard", "developpee"],
      description: "Longueur cible des réponses : courte, standard ou developpee.",
    },
  },
  required: ["name", "subtitle", "category", "location", "era", "lng", "lat", "description"],
} as const;

const characterChangesSchema = {
  ...characterInputSchema,
  properties: {
    ...characterInputSchema.properties,
    relationChanges: {
      type: "array",
      maxItems: 60,
      description: "Modifications ciblées des relations, sans remplacer toute la liste.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          targetId: { type: "string", description: "Identifiant exact du personnage lié." },
          action: { type: "string", enum: ["add", "remove", "set_strength"] },
          strength: { type: "number", minimum: 0.2, maximum: 1, description: "Intensité visuelle du filament." },
        },
        required: ["targetId", "action"],
      },
    },
  },
  required: [],
} as const;

export function registerWorldTools(callbacks: ToolCallbacks): { available: boolean; dispose: () => void } {
  const modelContext = document.modelContext;
  if (!modelContext) return { available: false, dispose: () => undefined };

  const controller = new AbortController();
  const register = (tool: Parameters<typeof modelContext.registerTool>[0]) => {
    const registration = modelContext.registerTool(tool, { signal: controller.signal });
    void Promise.resolve(registration).catch((error) => {
      console.error(`WebMCP tool registration failed: ${tool.name}`, error);
    });
  };

  register({
    name: "list_world_characters",
    title: "Lister les personnages de la carte",
    description: "Retourne les personnages actuellement visibles dans l’application, y compris les brouillons accessibles au propriétaire.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true },
    execute() {
      return {
        characters: callbacks.getCharacters().map(({ id, name, subtitle, category, location, era, lng, lat, avatar, status }) => ({
          id, name, subtitle, category, location, era, lng, lat, avatar, status: status ?? "published",
        })),
      };
    },
  });

  register({
    name: "create_character_drafts",
    title: "Créer plusieurs brouillons de personnages",
    description: "Crée et place de 1 à 20 personnages sur la carte en une opération. Les personnages restent en brouillon et doivent être confirmés par l’utilisateur avant publication.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        characters: { type: "array", minItems: 1, maxItems: 20, items: characterInputSchema },
      },
      required: ["characters"],
    },
    async execute(input) {
      callbacks.reportActivity("L’agent prépare les nouveaux personnages…");
      const data = await callApi("/api/characters", { method: "POST", body: JSON.stringify(input) });
      const characters = Array.isArray(data.characters) ? data.characters as Array<{ id?: string; name?: string }> : [];
      const ids = characters.map((character) => character.id).filter((id): id is string => typeof id === "string");
      await callbacks.refreshCharacters(ids);
      callbacks.focusCharacters(ids);
      callbacks.reportActivity(`${ids.length} brouillon${ids.length > 1 ? "s" : ""} placé${ids.length > 1 ? "s" : ""} sur la carte.`);
      return {
        created: characters,
        publication: "Les brouillons sont visibles. Utilise request_publish_characters pour demander la validation humaine.",
      };
    },
  });

  register({
    name: "get_world_character",
    title: "Lire le détail d’un personnage",
    description: "Retourne l’intégralité du profil éditorial, du réglage de réponse et des relations d’un personnage existant, sans le modifier.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string", description: "Identifiant exact du personnage." } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
    execute({ id }) {
      if (typeof id !== "string") throw new Error("Précise le personnage à consulter.");
      const character = callbacks.getCharacters().find((candidate) => candidate.id === id);
      if (!character) throw new Error("Personnage introuvable dans la carte actuelle.");
      return {
        character: {
          ...character,
          status: character.status ?? "published",
          responseLength: character.responseLength ?? "standard",
          relationStrengths: character.relationStrengths ?? {},
        },
      };
    },
  });

  register({
    name: "update_world_character",
    title: "Modifier un personnage",
    description: "Modifie un personnage dynamique existant sans le recréer ni changer son avatar : identité, contenu éditorial, longueur des réponses, relations ciblées ou coordonnées.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        changes: characterChangesSchema,
      },
      required: ["id", "changes"],
    },
    async execute({ id, changes }) {
      if (typeof id !== "string" || !changes || typeof changes !== "object") throw new Error("Précise le personnage et les modifications.");
      const data = await callApi(`/api/characters/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await callbacks.refreshCharacters([id]);
      callbacks.focusCharacters([id]);
      callbacks.reportActivity("Le personnage a été mis à jour sur la carte.");
      return data;
    },
  });

  register({
    name: "generate_character_avatar",
    title: "Générer l’avatar historique d’un personnage",
    description: "Génère avec FLUX.2 un portrait carré, dessiné et adapté à une pastille de carte, puis l’attache au brouillon indiqué. Cette action consomme un petit crédit d’image.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", description: "Identifiant exact du brouillon." },
        visualDescription: { type: "string", description: "Attributs visuels emblématiques à faire apparaître, sans répéter les règles générales de style." },
      },
      required: ["id"],
    },
    async execute({ id, visualDescription }) {
      if (typeof id !== "string") throw new Error("Précise le personnage à illustrer.");
      callbacks.reportActivity("FLUX dessine l’avatar du personnage…");
      const data = await callApi("/api/avatars/generate", {
        method: "POST",
        body: JSON.stringify({ id, visualDescription }),
      });
      await callbacks.refreshCharacters([id]);
      callbacks.focusCharacters([id]);
      callbacks.reportActivity("L’avatar FLUX est prêt et attaché au brouillon.");
      return data;
    },
  });

  register({
    name: "show_characters_on_map",
    title: "Montrer des personnages sur la carte",
    description: "Centre visiblement la carte sur un ou plusieurs personnages afin que l’utilisateur puisse contrôler leur placement.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { ids: { type: "array", minItems: 1, maxItems: 20, items: { type: "string" } } },
      required: ["ids"],
    },
    annotations: { readOnlyHint: true },
    execute({ ids }) {
      const safeIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
      callbacks.focusCharacters(safeIds);
      return { shown: safeIds };
    },
  });

  register({
    name: "request_publish_characters",
    title: "Demander la publication de personnages",
    description: "Ouvre dans l’application une validation humaine pour publier les brouillons indiqués. Cet outil ne contourne jamais la confirmation de l’utilisateur.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { ids: { type: "array", minItems: 1, maxItems: 20, items: { type: "string" } } },
      required: ["ids"],
    },
    execute({ ids }) {
      const safeIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
      if (safeIds.length === 0) throw new Error("Aucun brouillon n’a été indiqué.");
      callbacks.requestPublicationReview(safeIds);
      callbacks.focusCharacters(safeIds);
      return { status: "awaiting_human_confirmation", ids: safeIds };
    },
  });

  return { available: true, dispose: () => controller.abort() };
}
