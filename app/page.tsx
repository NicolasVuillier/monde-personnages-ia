"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  ArrowLeft,
  Compass,
  CornerDownLeft,
  Link2,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MessageCircle,
  Check,
  Pencil,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHAT_API_PATH, CHAT_MODEL_LABEL } from "@/features/chat/config";
import { avatarStyles, buildAvatarOptions, buildAvatarUrl } from "@/features/characters/avatars";
import { mythologyCharacters } from "@/features/characters/mythology";
import { loadRemoteCharacters } from "@/features/characters/remote";
import { loadLocalCharacters, saveLocalCharacters } from "@/features/characters/storage";
import type { Category, Character, CharacterDraft, ChatMessage, RemoteCharacter } from "@/features/characters/types";
import { CharacterMap, type CharacterMapHandle } from "@/features/map/character-map";
import { mapThemes, type MapThemeId } from "@/features/map/themes";
import { registerWorldTools } from "@/features/webmcp/register-world-tools";

const emptyCharacterDraft: CharacterDraft = {
  name: "",
  subtitle: "",
  location: "",
  description: "",
  greeting: "",
  color: "#ff73c7",
  lng: null,
  lat: null,
  avatarStyle: "notionists",
  avatarSeed: "",
  avatarBatch: 0,
};

const creatorColors = ["#58e6bd", "#72a7ff", "#ff73c7", "#ffb45c", "#b68cff", "#d4ff68"];

const starterCharacters: Character[] = [
  {
    id: "socrate",
    name: "Socrate",
    subtitle: "Le questionneur d’Athènes",
    category: "Histoire",
    location: "Athènes, Grèce",
    era: "470–399 av. J.-C.",
    lng: 23.7275,
    lat: 37.9838,
    color: "#58e6bd",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Socrate&backgroundColor=d1fae5",
    popularity: 1,
    description:
      "Un Socrate curieux et exigeant, qui répond surtout par des questions et t’invite à examiner ce que tu crois savoir.",
    greeting: "Bienvenue à Athènes. Quelle certitude aimerais-tu mettre à l’épreuve aujourd’hui ?",
    reply: "C’est une piste intéressante. Mais qu’entends-tu exactement par ces mots ?",
    relations: ["platon", "athena"],
  },
  {
    id: "platon",
    name: "Platon",
    subtitle: "L’architecte des idées",
    category: "Histoire",
    location: "Athènes, Grèce",
    era: "428–348 av. J.-C.",
    lng: 23.755,
    lat: 38.012,
    color: "#72a7ff",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Platon&backgroundColor=dbeafe",
    popularity: 0.88,
    description:
      "Un guide à travers les grandes idées : justice, beauté, vérité et organisation de la cité.",
    greeting: "Approche. Veux-tu parler du monde visible, ou de ce qui pourrait exister derrière lui ?",
    reply: "Imaginons maintenant l’idée parfaite qui se cache derrière ton exemple.",
    relations: ["socrate", "athena"],
  },
  {
    id: "leonard",
    name: "Léonard de Vinci",
    subtitle: "Artiste, ingénieur, observateur",
    category: "Histoire",
    location: "Florence, Italie",
    era: "1452–1519",
    lng: 11.2558,
    lat: 43.7696,
    color: "#ffb45c",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Leonard&backgroundColor=ffedd5",
    popularity: 0.95,
    description:
      "Une présence passionnée par les mécanismes, le mouvement, le dessin et les questions qui relient l’art à la science.",
    greeting: "J’observe une machine dans chaque être vivant. Que souhaites-tu comprendre ou fabriquer ?",
    reply: "Dessine-le d’abord en pensée : où naît le mouvement, et où se perd-il ?",
    relations: ["mecano"],
  },
  {
    id: "curie",
    name: "Marie Curie",
    subtitle: "Scientifique de l’invisible",
    category: "Histoire",
    location: "Paris, France",
    era: "1867–1934",
    lng: 2.3522,
    lat: 48.8566,
    color: "#b68cff",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=MarieCurie&backgroundColor=ede9fe",
    popularity: 0.82,
    description:
      "Une conversation tournée vers la recherche, la patience expérimentale et la place des femmes dans les sciences.",
    greeting: "La recherche demande de la rigueur, mais aussi de l’imagination. Que veux-tu observer ?",
    reply: "Commençons par distinguer ce que nous savons de ce que nous supposons.",
    relations: ["leonard"],
  },
  {
    id: "cleopatre",
    name: "Cléopâtre VII",
    subtitle: "La dernière reine d’Égypte",
    category: "Histoire",
    location: "Alexandrie, Égypte",
    era: "69–30 av. J.-C.",
    lng: 29.9187,
    lat: 31.2001,
    color: "#ffd85a",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Cleopatre&backgroundColor=fef3c7",
    popularity: 0.78,
    description:
      "Diplomatie, pouvoir et Alexandrie racontés par une souveraine située au croisement de plusieurs mondes.",
    greeting: "Alexandrie accueille les langues et les savoirs du monde. Qu’apportes-tu avec toi ?",
    reply: "Toute décision publique possède un visage caché. Cherchons-le ensemble.",
    relations: ["athena"],
  },
  {
    id: "athena",
    name: "Athéna",
    subtitle: "Déesse de la stratégie et des arts",
    category: "Mythes",
    location: "Acropole d’Athènes",
    era: "Temps mythologique",
    lng: 23.7266,
    lat: 37.9715,
    color: "#ff73c7",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Athena&backgroundColor=fce7f3",
    popularity: 0.9,
    description:
      "Une Athéna contemporaine qui parle de stratégie, de fabrication, de prudence et des vieux récits grecs.",
    greeting: "La force sans pensée se retourne contre elle-même. Quel choix dois-tu préparer ?",
    reply: "Ne cherchons pas seulement la victoire : cherchons la forme juste de l’action.",
    relations: ["socrate", "platon", "zeus", "hera", "poseidon", "hephaestus", "heracles", "odysseus"],
  },
  {
    id: "anansi",
    name: "Anansi",
    subtitle: "Le tisseur d’histoires",
    category: "Mythes",
    location: "Accra, Ghana",
    era: "Tradition orale",
    lng: -0.187,
    lat: 5.6037,
    color: "#ff8c64",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Anansi&backgroundColor=fee2e2",
    popularity: 0.63,
    description:
      "Farceur, conteur et araignée : Anansi transforme les problèmes en histoires et les histoires en chemins de traverse.",
    greeting: "J’ai une histoire pour chaque piège. Mais quel piège as-tu rencontré ?",
    reply: "Ah ! Ton problème marche sur deux pattes, mais sa solution en possède huit.",
    relations: ["mecano"],
  },
  {
    id: "sherlock",
    name: "Sherlock Holmes",
    subtitle: "Consultant en déductions",
    category: "Fiction",
    location: "Londres, Royaume-Uni",
    era: "Époque victorienne",
    lng: -0.1586,
    lat: 51.5238,
    color: "#7ac8ff",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Sherlock&backgroundColor=e0f2fe",
    popularity: 0.86,
    description:
      "Une intelligence d’enquête qui observe les détails, écarte les hypothèses faibles et réclame des faits.",
    greeting: "Vous avez déjà remarqué quelque chose d’important sans savoir que vous l’aviez remarqué. Quoi donc ?",
    reply: "Séparons les faits de l’interprétation. Quel détail pouvez-vous vérifier ?",
    relations: ["curie"],
  },
  {
    id: "aiko",
    name: "Aïko-7",
    subtitle: "Archiviste des futurs oubliés",
    category: "Créations",
    location: "Tokyo, Japon",
    era: "Créée en 2026",
    lng: 139.6917,
    lat: 35.6895,
    color: "#5df2ef",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Aiko7&backgroundColor=ccfbf1",
    popularity: 0.54,
    description:
      "Personnage original publié par une créatrice : elle imagine les objets quotidiens que nous aurons oubliés dans cent ans.",
    greeting: "Je collecte les futurs qui n’ont jamais eu lieu. Veux-tu m’en confier un ?",
    reply: "Je l’ajoute aux archives. Dans cent ans, ce détail sera peut-être le plus précieux.",
    relations: ["mecano"],
  },
  {
    id: "mecano",
    name: "Le Mécano des rêves",
    subtitle: "Réparateur d’objets impossibles",
    category: "Créations",
    location: "Dieulefit, France",
    era: "Créé en 2026",
    lng: 5.0631,
    lat: 44.5239,
    color: "#d4ff68",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=MecanoDesReves&backgroundColor=ecfccb",
    popularity: 0.68,
    description:
      "Un personnage original qui diagnostique les automates fatigués, les mécanismes poétiques et les machines qui refusent d’obéir.",
    greeting: "Pose ta machine sur l’établi. Quel mouvement devrait-elle faire, et que fait-elle à la place ?",
    reply: "Écoutons d’abord le mécanisme. Une panne est souvent un mouvement qui cherche une autre route.",
    relations: ["leonard", "anansi", "aiko"],
  },
];

const filters: Array<"Tous" | Category> = ["Tous", "Histoire", "Mythes", "Fiction", "Créations"];

export default function Home() {
  const mapRef = useRef<CharacterMapHandle>(null);
  const remoteCharactersRef = useRef<RemoteCharacter[]>([]);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Tous");
  const [selectedId, setSelectedId] = useState("socrate");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useState<MapThemeId>("lagon");
  const [isSending, setIsSending] = useState(false);
  const [chatQuotaRemaining, setChatQuotaRemaining] = useState<number | null>(null);
  const [customCharacters, setCustomCharacters] = useState<Character[]>([]);
  const [remoteCharacters, setRemoteCharacters] = useState<RemoteCharacter[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorDraft, setCreatorDraft] = useState<CharacterDraft>(emptyCharacterDraft);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [isPlacingCharacter, setIsPlacingCharacter] = useState(false);
  const [webMcpAvailable, setWebMcpAvailable] = useState(false);
  const [agentActivity, setAgentActivity] = useState("");
  const [isSyncingCharacters, setIsSyncingCharacters] = useState(false);

  const characters = useMemo(
    () => [...starterCharacters, ...mythologyCharacters, ...remoteCharacters, ...customCharacters],
    [customCharacters, remoteCharacters],
  );
  const charactersRef = useRef<Character[]>(characters);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? characters[0],
    [characters, selectedId],
  );

  const creatorAvatarOptions = useMemo(
    () => buildAvatarOptions(
      `${creatorDraft.name} ${creatorDraft.subtitle}`,
      creatorDraft.avatarStyle,
      creatorDraft.avatarBatch,
      creatorDraft.color,
    ),
    [creatorDraft.name, creatorDraft.subtitle, creatorDraft.avatarStyle, creatorDraft.avatarBatch, creatorDraft.color],
  );

  const creatorAvatarSeed = creatorDraft.avatarSeed || creatorAvatarOptions[0].seed;
  const creatorAvatarUrl = buildAvatarUrl(
    creatorDraft.avatarStyle,
    creatorAvatarSeed,
    creatorDraft.color,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomCharacters(loadLocalCharacters()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refreshRemoteCharacters = useCallback(async (preferredIds: string[] = []) => {
    try {
      const next = await loadRemoteCharacters();
      remoteCharactersRef.current = next;
      setRemoteCharacters(next);
      if (preferredIds.length > 0) {
        const preferred = next.filter((character) => preferredIds.includes(character.id));
        if (preferred.length > 0) {
          setActiveFilter("Tous");
          setSelectedId(preferred[0].id);
          setSheetOpen(false);
          window.setTimeout(() => mapRef.current?.focusCharacters(preferred), 0);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Les créations WebMCP ne sont pas disponibles.";
      setAgentActivity(message);
    }
  }, []);

  const focusCharactersById = useCallback((ids: string[]) => {
    const targets = charactersRef.current.filter((character) => ids.includes(character.id));
    if (targets.length === 0) return;
    setActiveFilter("Tous");
    setSelectedId(targets[0].id);
    setSheetOpen(false);
    window.setTimeout(() => mapRef.current?.focusCharacters(targets), 0);
  }, []);

  const syncRemoteCharacters = useCallback(async () => {
    if (isSyncingCharacters) return;
    setIsSyncingCharacters(true);
    setAgentActivity("Synchronisation des personnages…");
    try {
      const previousIds = new Set(remoteCharactersRef.current.map((character) => character.id));
      const next = await loadRemoteCharacters();
      const newCharacters = next.filter((character) => !previousIds.has(character.id));
      remoteCharactersRef.current = next;
      setRemoteCharacters(next);

      if (newCharacters.length > 0) {
        const newest = newCharacters[newCharacters.length - 1];
        setActiveFilter("Tous");
        setSelectedId(newest.id);
        setSheetOpen(false);
        window.setTimeout(() => mapRef.current?.focusCharacters([newest]), 0);
        setAgentActivity(`${newCharacters.length} nouveau${newCharacters.length > 1 ? "x" : ""} personnage${newCharacters.length > 1 ? "s" : ""} affiché${newCharacters.length > 1 ? "s" : ""}.`);
      } else {
        setAgentActivity(`${next.length} création${next.length > 1 ? "s" : ""} synchronisée${next.length > 1 ? "s" : ""}.`);
      }
    } catch (error) {
      setAgentActivity(error instanceof Error ? error.message : "La synchronisation a échoué.");
    } finally {
      setIsSyncingCharacters(false);
    }
  }, [isSyncingCharacters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshRemoteCharacters(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshRemoteCharacters]);

  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    if (!webMcpAvailable) return;
    let running = false;

    const poll = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const previousIds = new Set(remoteCharactersRef.current.map((character) => character.id));
        const next = await loadRemoteCharacters();
        const additions = next.filter((character) => !previousIds.has(character.id));
        remoteCharactersRef.current = next;
        setRemoteCharacters(next);

        if (additions.length > 0) {
          const newest = additions[0];
          setActiveFilter("Tous");
          setSelectedId(newest.id);
          setSheetOpen(false);
          window.setTimeout(() => mapRef.current?.focusCharacters([newest]), 0);
          setAgentActivity(`${additions.length} nouveau${additions.length > 1 ? "x" : ""} personnage${additions.length > 1 ? "s" : ""} affiché${additions.length > 1 ? "s" : ""} automatiquement.`);
        }
      } catch {
        // Le bouton manuel reste disponible si une synchronisation ponctuelle échoue.
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => void poll(), 2500);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [webMcpAvailable]);

  useEffect(() => {
    const registration = registerWorldTools({
      getCharacters: () => charactersRef.current,
      refreshCharacters: refreshRemoteCharacters,
      focusCharacters: focusCharactersById,
      reportActivity: setAgentActivity,
    });
    setWebMcpAvailable(registration.available);
    return registration.dispose;
  }, [focusCharactersById, refreshRemoteCharacters]);

  function openCharacter(id: string) {
    const character = characters.find((item) => item.id === id);
    if (!character) return;
    setSelectedId(id);
    setChatMode(false);
    setMessages([]);
    setSheetOpen(true);
    mapRef.current?.focusCharacter(character, characters);
  }

  function resetWorld() {
    setSheetOpen(false);
    setChatMode(false);
    mapRef.current?.resetWorld();
  }

  function startConversation() {
    setChatMode(true);
    setMessages([{ from: "character", text: selected.greeting }]);
  }

  function openCreator() {
    setCreatorDraft(emptyCharacterDraft);
    setEditingCharacterId(null);
    setCreatorError(null);
    setIsPlacingCharacter(false);
    setCreatorOpen(true);
  }

  function openCharacterEditor(character: Character) {
    if (!character.isCustom) return;
    setEditingCharacterId(character.id);
    setCreatorDraft({
      name: character.name,
      subtitle: character.subtitle,
      location: character.location,
      description: character.description,
      greeting: character.greeting,
      color: character.color,
      lng: character.lng,
      lat: character.lat,
      avatarStyle: character.avatarStyle ?? "notionists",
      avatarSeed: character.avatarSeed ?? character.name,
      avatarBatch: character.avatarBatch ?? 0,
    });
    setCreatorError(null);
    setIsPlacingCharacter(false);
    setCreatorOpen(true);
  }

  function closeCreator() {
    setCreatorOpen(false);
    setEditingCharacterId(null);
    setCreatorError(null);
  }

  function chooseCharacterLocation() {
    if (!mapReady || !mapRef.current) {
      setCreatorError("Attends que la carte soit complètement chargée.");
      return;
    }
    setCreatorError(null);
    setCreatorOpen(false);
    setSheetOpen(false);
    setIsPlacingCharacter(true);
  }

  function handleMapPlacement(lng: number, lat: number) {
    setCreatorDraft((current) => ({ ...current, lng, lat }));
    setIsPlacingCharacter(false);
    setCreatorOpen(true);
    setCreatorError(null);
  }

  function cancelCharacterPlacement() {
    setIsPlacingCharacter(false);
    setCreatorOpen(true);
  }

  function saveCharacter(event: FormEvent) {
    event.preventDefault();
    const name = creatorDraft.name.trim();
    const subtitle = creatorDraft.subtitle.trim();
    const location = creatorDraft.location.trim();
    const description = creatorDraft.description.trim();
    const greeting = creatorDraft.greeting.trim();

    if (!name || !subtitle || !location || !description) {
      setCreatorError("Remplis le nom, le rôle, le lieu et la personnalité.");
      return;
    }
    if (creatorDraft.lng === null || creatorDraft.lat === null) {
      setCreatorError("Choisis aussi un emplacement en cliquant sur la carte.");
      return;
    }

    const avatarSeed = creatorDraft.avatarSeed || creatorAvatarOptions[0].seed;
    const avatar = buildAvatarUrl(creatorDraft.avatarStyle, avatarSeed, creatorDraft.color);
    const existingCharacter = editingCharacterId
      ? customCharacters.find((character) => character.id === editingCharacterId)
      : undefined;

    if (editingCharacterId && !existingCharacter) {
      setCreatorError("Ce personnage n’est plus disponible sur cet appareil.");
      return;
    }

    const savedCharacter: Character = existingCharacter
      ? {
          ...existingCharacter,
          name,
          subtitle,
          location,
          lng: creatorDraft.lng,
          lat: creatorDraft.lat,
          color: creatorDraft.color,
          avatar,
          avatarStyle: creatorDraft.avatarStyle,
          avatarSeed,
          avatarBatch: creatorDraft.avatarBatch,
          description,
          greeting: greeting || `Bonjour, je suis ${name}. De quoi veux-tu parler ?`,
        }
      : {
          id: `creation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          subtitle,
          category: "Créations",
          location,
          era: "Créé par toi",
          lng: creatorDraft.lng,
          lat: creatorDraft.lat,
          color: creatorDraft.color,
          avatar,
          avatarStyle: creatorDraft.avatarStyle,
          avatarSeed,
          avatarBatch: creatorDraft.avatarBatch,
          popularity: 0.7,
          description,
          greeting: greeting || `Bonjour, je suis ${name}. De quoi veux-tu parler ?`,
          reply: "Raconte-m’en davantage, j’aimerais comprendre ce que tu imagines.",
          relations: [],
          isCustom: true,
        };

    const nextCharacters = existingCharacter
      ? customCharacters.map((character) => character.id === savedCharacter.id ? savedCharacter : character)
      : [...customCharacters, savedCharacter];
    setCustomCharacters(nextCharacters);
    saveLocalCharacters(nextCharacters);
    setCreatorOpen(false);
    setEditingCharacterId(null);
    setCreatorDraft(emptyCharacterDraft);
    setActiveFilter("Tous");
    setSelectedId(savedCharacter.id);
    setChatMode(false);
    setMessages([]);
    setSheetOpen(true);
    const allNextCharacters = [...starterCharacters, ...mythologyCharacters, ...remoteCharacters, ...nextCharacters];
    window.setTimeout(() => mapRef.current?.focusCharacter(savedCharacter, allNextCharacters), 0);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    const conversation = messages
      .filter((message) => message.from !== "system")
      .map((message) => ({
        role: message.from === "character" ? "assistant" : "user",
        content: message.text,
      }));

    setMessages((current) => [...current, { from: "user", text }]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch(CHAT_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          character: {
            id: selected.id,
            name: selected.name,
            subtitle: selected.subtitle,
            description: selected.description,
            responseLength: selected.responseLength ?? "standard",
          },
          messages: [...conversation, { role: "user", content: text }],
        }),
      });

      const data = await response.json() as {
        text?: string;
        error?: string;
        quota?: { limit: number; remaining: number; day: string };
      };

      if (data.quota) setChatQuotaRemaining(data.quota.remaining);

      if (!response.ok) {
        throw new Error(data.error || "Le personnage ne peut pas répondre pour le moment.");
      }

      const generatedReply = data.text?.trim();

      if (!generatedReply) throw new Error("La réponse reçue était vide. Réessaie dans un instant.");
      setMessages((current) => [...current, { from: "character", text: generatedReply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "La connexion au personnage a échoué.";
      setMessages((current) => [...current, { from: "system", text: message }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className={`world-app map-theme-${mapTheme}`}>
      <CharacterMap
        ref={mapRef}
        characters={characters}
        activeFilter={activeFilter}
        selectedId={selectedId}
        theme={mapTheme}
        isPlacingCharacter={isPlacingCharacter}
        onCharacterOpen={openCharacter}
        onPlacement={handleMapPlacement}
        onReady={() => setMapReady(true)}
        onError={setMapError}
      />
      <div className="map-vignette" aria-hidden="true" />
      <div className="map-grain" aria-hidden="true" />

      <header className="app-header">
        <button className="brand" type="button" onClick={resetWorld} aria-label="Revenir à la vue du monde">
          <span className="brand-orbit"><Compass size={18} /></span>
          <span><strong>LE MONDE</strong><small>des personnages IA</small></span>
        </button>

        <div className="demo-status">
          <span className="live-dot" />
          Prototype vivant
          <span className="status-separator" />
          {characters.length} présences
        </div>

        <div className="header-actions">
          <button className="creator-button" type="button" onClick={openCreator} aria-label="Créer un personnage">
            <UserRoundPlus size={17} />
            <span>Créer un personnage</span>
          </button>

          <span className="ai-free-badge" title={`Conversations propulsées par ${CHAT_MODEL_LABEL}`}>
            <Sparkles size={16} />
            <span>IA gratuite</span>
          </span>

          <Popover>
            <PopoverTrigger asChild>
              <button className="settings-button" type="button" aria-label="Paramètres de la carte">
                <Settings2 size={18} /><span>Style de la carte</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={12} className="map-settings">
              <PopoverHeader>
                <PopoverTitle>Ambiance de la carte</PopoverTitle>
                <PopoverDescription>Teste les styles directement sur le monde.</PopoverDescription>
              </PopoverHeader>
              <div className="theme-options">
                {mapThemes.map((theme) => (
                  <button
                    type="button"
                    key={theme.id}
                    className={mapTheme === theme.id ? "active" : ""}
                    onClick={() => setMapTheme(theme.id)}
                  >
                    <span
                      className="theme-preview"
                      style={{ background: `linear-gradient(135deg, ${theme.swatches[0]} 0 36%, ${theme.swatches[1]} 36% 70%, ${theme.swatches[2]} 70%)` }}
                    />
                    <span className="theme-copy"><strong>{theme.label}</strong><small>{theme.description}</small></span>
                    {mapTheme === theme.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <p className="zoom-note">Le zoom va maintenant jusqu’au niveau des rues et des bâtiments.</p>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {webMcpAvailable && (
        <div className="webmcp-status" aria-live="polite">
          <span className="webmcp-status-dot" />
          <p>
            <strong>Studio agent connecté</strong>
            <small>{agentActivity || "ChatGPT peut créer, illustrer et placer des personnages avec WebMCP."}</small>
          </p>
          <button
            type="button"
            className="webmcp-sync-button"
            onClick={() => void syncRemoteCharacters()}
            disabled={isSyncingCharacters}
            aria-label="Synchroniser les personnages"
            title="Synchroniser les personnages"
          >
            <RefreshCw className={isSyncingCharacters ? "spin-icon" : ""} size={15} />
            <span>Synchroniser</span>
          </button>
        </div>
      )}

      {isPlacingCharacter && (
        <div className="placement-banner" role="status">
          <span><MapPin size={18} /></span>
          <p><strong>Place ton personnage</strong><small>Touche l’endroit exact sur la carte.</small></p>
          <button type="button" onClick={cancelCharacterPlacement}><X size={16} /> Annuler</button>
        </div>
      )}

      <nav className="filter-bar" aria-label="Filtrer les personnages">
        {filters.map((filter) => (
          <button
            type="button"
            key={filter}
            className={activeFilter === filter ? "active" : ""}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </nav>

      <aside className="intro-card">
        <p className="eyebrow"><Sparkles size={13} /> EXPLORE LES PRÉSENCES</p>
        <h1>Chaque point<br />a quelque chose à te dire.</h1>
        <p>Voyage sur la carte, rencontre une voix et suis les liens qui relient les idées à travers le monde.</p>
        <div className="intro-hint">
          <span className="hint-avatar-stack">
            {characters.slice(0, 3).map((character) => <img key={character.id} src={character.avatar} alt="" />)}
          </span>
          <span>Touche une pastille pour commencer</span>
        </div>
      </aside>

      <button className="world-reset" type="button" onClick={resetWorld}>
        <LocateFixed size={16} /> Vue du monde
      </button>

      <div className="map-legend" aria-label="Légende">
        <span><i style={{ background: "#58e6bd" }} /> Histoire</span>
        <span><i style={{ background: "#ff73c7" }} /> Mythes</span>
        <span><i style={{ background: "#7ac8ff" }} /> Fiction</span>
        <span><i style={{ background: "#d4ff68" }} /> Créations</span>
      </div>

      {!mapReady && (
        <div className="map-loading">
          {mapError ? (
            <div className="map-error">
              <p>{mapError}</p>
              <button type="button" onClick={() => window.location.reload()}>Réessayer</button>
            </div>
          ) : (
            <><span className="loading-orbit" /><p>Le monde apparaît…</p></>
          )}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="character-sheet border-white/10 bg-[#07100f]/96 p-0 text-white backdrop-blur-2xl sm:max-w-[430px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected.name}</SheetTitle>
            <SheetDescription>{selected.subtitle}</SheetDescription>
          </SheetHeader>

          {!chatMode ? (
            <div className="profile-view">
              <div className="profile-visual" style={{ "--profile-color": selected.color } as CSSProperties}>
                <img src={selected.avatar} alt={`Portrait illustré de ${selected.name}`} />
                <span className="profile-category">{selected.category}</span>
                <div className="profile-location"><MapPin size={14} /> {selected.location}</div>
              </div>

              <div className="profile-copy">
                <p className="profile-era">{selected.era}</p>
                <h2>{selected.name}</h2>
                <p className="profile-subtitle">{selected.subtitle}</p>
                <p className="profile-description">{selected.description}</p>

                <div className="profile-meta">
                  <span>
                    <Users size={15} />
                    {selected.isRemote ? "Création WebMCP" : selected.isCustom ? "Ta création locale" : "Présence publique"}
                  </span>
                  <span><MessageCircle size={15} /> Français</span>
                </div>

                <button className="talk-button" type="button" onClick={startConversation}>
                  <span>Parler avec {selected.name}</span><MessageCircle size={19} />
                </button>

                {selected.isCustom && !selected.isRemote && (
                  <button className="edit-character-button" type="button" onClick={() => openCharacterEditor(selected)}>
                    <Pencil size={16} /> Modifier ce personnage
                  </button>
                )}

                {selected.relations.length > 0 && (
                  <section className="relations">
                    <p><Link2 size={14} /> PERSONNAGES RELIÉS</p>
                    <div>
                      {selected.relations.map((id) => {
                        const relation = characters.find((item) => item.id === id);
                        if (!relation) return null;
                        return (
                          <button key={id} type="button" onClick={() => openCharacter(id)}>
                            <img src={relation.avatar} alt="" />
                            <span>{relation.name}<small>{relation.location}</small></span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="chat-view">
              <header className="chat-header">
                <button type="button" onClick={() => setChatMode(false)} aria-label="Revenir à la fiche"><ArrowLeft size={19} /></button>
                <img src={selected.avatar} alt="" />
                <span><strong>{selected.name}</strong><small><i /> Présence active</small></span>
              </header>

              <div className="chat-context"><MapPin size={13} /> Conversation depuis {selected.location}</div>

              <div className="messages" aria-live="polite">
                <p className="simulation-note live">
                  CONVERSATION AVEC {CHAT_MODEL_LABEL.toLocaleUpperCase("fr")} · 30 MESSAGES PAR JOUR
                </p>
                <p className="chat-quota-note">
                  {chatQuotaRemaining === null
                    ? "Le compteur s’actualise après ton premier message."
                    : `${chatQuotaRemaining} message${chatQuotaRemaining > 1 ? "s" : ""} restant${chatQuotaRemaining > 1 ? "s" : ""} aujourd’hui.`}
                </p>
                {messages.map((message, index) => (
                  <div key={`${message.from}-${index}`} className={`message ${message.from}`}>
                    {message.from === "character" && <img src={selected.avatar} alt="" />}
                    <p>{message.text}</p>
                  </div>
                ))}
                {isSending && (
                  <div className="typing-indicator" role="status">
                    <LoaderCircle size={15} /> {selected.name} réfléchit…
                  </div>
                )}
              </div>

              <form className="chat-input" onSubmit={sendMessage}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Écrire à ${selected.name}…`}
                  aria-label={`Message pour ${selected.name}`}
                  disabled={isSending || chatQuotaRemaining === 0}
                />
                <button type="submit" aria-label="Envoyer le message" disabled={isSending || chatQuotaRemaining === 0}>
                  {isSending ? <LoaderCircle className="spin-icon" size={18} /> : <CornerDownLeft size={18} />}
                </button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={creatorOpen}
        onOpenChange={(open) => {
          setCreatorOpen(open);
          if (!open && !isPlacingCharacter) {
            setEditingCharacterId(null);
            setCreatorError(null);
          }
        }}
      >
        <DialogContent className="creator-dialog">
          <DialogHeader className="creator-dialog-header">
            <div className="creator-avatar-preview" style={{ "--creator-color": creatorDraft.color } as CSSProperties}>
              <img
                src={creatorAvatarUrl}
                alt="Aperçu du personnage"
              />
            </div>
            <div>
              <DialogTitle>{editingCharacterId ? "Modifier le personnage" : "Créer un personnage"}</DialogTitle>
              <DialogDescription>
                {editingCharacterId
                  ? "Affine son identité, son apparence et sa place dans le monde."
                  : "Donne-lui une identité, une voix et une place dans le monde."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form className="creator-form" onSubmit={saveCharacter}>
            <section className="creator-avatar-section" aria-labelledby="creator-avatar-title">
              <div className="creator-avatar-heading">
                <span id="creator-avatar-title">Avatar gratuit</span>
                <button
                  type="button"
                  onClick={() => setCreatorDraft((current) => ({
                    ...current,
                    avatarBatch: current.avatarBatch + 1,
                    avatarSeed: "",
                  }))}
                >
                  <RefreshCw size={13} /> Six nouveaux
                </button>
              </div>

              <div className="creator-avatar-styles" aria-label="Style de l’avatar">
                {avatarStyles.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={creatorDraft.avatarStyle === style.id ? "active" : ""}
                    onClick={() => setCreatorDraft((current) => ({
                      ...current,
                      avatarStyle: style.id,
                      avatarSeed: "",
                    }))}
                    aria-pressed={creatorDraft.avatarStyle === style.id}
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              <div className="creator-avatar-options">
                {creatorAvatarOptions.map((option, index) => {
                  const selectedAvatarSeed = creatorDraft.avatarSeed || creatorAvatarOptions[0].seed;
                  const isSelected = selectedAvatarSeed === option.seed;
                  return (
                    <button
                      key={option.seed}
                      type="button"
                      className={isSelected ? "active" : ""}
                      onClick={() => setCreatorDraft((current) => ({ ...current, avatarSeed: option.seed }))}
                      aria-label={`Choisir la proposition d’avatar ${index + 1}`}
                      aria-pressed={isSelected}
                    >
                      <img src={option.url} alt="" />
                      {isSelected && <span><Check size={12} /></span>}
                    </button>
                  );
                })}
              </div>

              <p>Le nom et le titre créent la série. Une fois choisi, l’avatar reste verrouillé.</p>
            </section>

            <div className="creator-form-grid">
              <label>
                <span>Nom</span>
                <input
                  value={creatorDraft.name}
                  onChange={(event) => setCreatorDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex. La Gardienne des lucioles"
                  autoFocus
                />
              </label>

              <label>
                <span>Rôle ou titre</span>
                <input
                  value={creatorDraft.subtitle}
                  onChange={(event) => setCreatorDraft((current) => ({ ...current, subtitle: event.target.value }))}
                  placeholder="Ex. Exploratrice des rêves"
                />
              </label>

              <label className="creator-field-wide">
                <span>Lieu affiché</span>
                <input
                  value={creatorDraft.location}
                  onChange={(event) => setCreatorDraft((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Ex. Dieulefit, France"
                />
              </label>

              <label className="creator-field-wide">
                <span>Personnalité et manière de répondre</span>
                <textarea
                  value={creatorDraft.description}
                  onChange={(event) => setCreatorDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Décris son caractère, ce qu’il connaît et sa façon de parler…"
                  rows={3}
                />
              </label>

              <label className="creator-field-wide">
                <span>Première phrase <small>facultatif</small></span>
                <textarea
                  value={creatorDraft.greeting}
                  onChange={(event) => setCreatorDraft((current) => ({ ...current, greeting: event.target.value }))}
                  placeholder="Que dit-il quand on vient le rencontrer ?"
                  rows={2}
                />
              </label>
            </div>

            <div className="creator-options-row">
              <div className="creator-colors" aria-label="Couleur du personnage">
                <span>Couleur</span>
                <div>
                  {creatorColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={creatorDraft.color === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => setCreatorDraft((current) => ({ ...current, color }))}
                      aria-label={`Choisir la couleur ${color}`}
                    >
                      {creatorDraft.color === color && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className={`choose-location-button ${creatorDraft.lng !== null ? "chosen" : ""}`}
                type="button"
                onClick={chooseCharacterLocation}
              >
                <MapPin size={17} />
                <span>
                  <strong>{creatorDraft.lng !== null ? "Position choisie" : "Placer sur la carte"}</strong>
                  <small>
                    {creatorDraft.lng !== null && creatorDraft.lat !== null
                      ? `${creatorDraft.lat.toFixed(3)}, ${creatorDraft.lng.toFixed(3)}`
                      : "Tu choisiras l’endroit exact"}
                  </small>
                </span>
              </button>
            </div>

            {creatorError && <p className="creator-error" role="alert">{creatorError}</p>}

            <div className="creator-form-actions">
              <button type="button" className="creator-cancel-button" onClick={closeCreator}>Annuler</button>
              <button type="submit" className="creator-submit-button">
                {editingCharacterId ? <Pencil size={16} /> : <Sparkles size={16} />}
                {editingCharacterId ? "Enregistrer" : "Faire apparaître"}
              </button>
            </div>

            <p className="creator-storage-note">Cette création est conservée uniquement sur cet appareil.</p>
          </form>
        </DialogContent>
      </Dialog>

    </main>
  );
}
