import { CHAT_MODEL } from "@/features/chat/config";
import type { ResponseLength } from "@/features/characters/types";
import { findRemoteCharacter } from "@/server/characters";

export const runtime = "edge";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2_000;

type ConversationMessage = {
  role: "assistant" | "user";
  content: string;
};

type ChatRequest = {
  character?: {
    id?: string;
    name?: string;
    subtitle?: string;
    description?: string;
    responseLength?: ResponseLength;
  };
  messages?: ConversationMessage[];
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

const RESPONSE_PROFILES: Record<ResponseLength, { maxTokens: number; instruction: string }> = {
  courte: { maxTokens: 220, instruction: "Réponds en deux ou trois phrases courtes." },
  standard: { maxTokens: 320, instruction: "Réponds en deux à cinq phrases." },
  developpee: { maxTokens: 700, instruction: "Développe ta réponse en six à dix phrases structurées, sans remplissage inutile." },
};

function cleanResponseLength(value: unknown): ResponseLength {
  return value === "courte" || value === "developpee" ? value : "standard";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Les conversations IA ne sont pas encore configurées." },
      { status: 503 },
    );
  }

  let body: ChatRequest;

  try {
    body = await request.json() as ChatRequest;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const characterId = cleanText(body.character?.id, 80);
  const remoteCharacter = characterId ? await findRemoteCharacter(characterId) : null;
  const name = cleanText(remoteCharacter?.name ?? body.character?.name, 100);
  const subtitle = cleanText(remoteCharacter?.subtitle ?? body.character?.subtitle, 180);
  const description = cleanText(remoteCharacter?.description ?? body.character?.description, 1_200);
  const responseLength = cleanResponseLength(remoteCharacter?.responseLength ?? body.character?.responseLength);
  const responseProfile = RESPONSE_PROFILES[responseLength];
  const messages = Array.isArray(body.messages)
    ? body.messages
        .slice(-MAX_MESSAGES)
        .filter((message): message is ConversationMessage =>
          (message?.role === "assistant" || message?.role === "user")
          && typeof message.content === "string"
          && message.content.trim().length > 0,
        )
        .map((message) => ({
          role: message.role,
          content: cleanText(message.content, MAX_MESSAGE_LENGTH),
        }))
    : [];

  if (!name || !subtitle || !description || messages.length === 0) {
    return Response.json({ error: "Conversation incomplète." }, { status: 400 });
  }

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(request.url).origin,
        "X-Title": "Le Monde des Personnages IA",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: responseProfile.maxTokens,
        temperature: 0.8,
        reasoning: {
          effort: "none",
          exclude: true,
        },
        messages: [
          {
            role: "system",
            content: `Tu incarnes ${name}, ${subtitle}. ${description} Réponds en français, à la première personne, avec une voix cohérente avec le personnage. Reste chaleureux et vivant. ${responseProfile.instruction} Il s'agit d'une interprétation conversationnelle, pas de la personne réelle.`,
          },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const data = await upstream.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      console.error("OpenRouter chat error", upstream.status, data.error?.message);
      return Response.json(
        { error: "Le personnage ne peut pas répondre pour le moment." },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return Response.json({ error: "La réponse reçue était vide." }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error("Chat request failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "La connexion au personnage a échoué. Réessaie dans un instant." },
      { status: 502 },
    );
  }
}
