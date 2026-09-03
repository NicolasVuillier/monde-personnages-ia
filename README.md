# Le Monde des Personnages IA

An interactive world map where people can discover and talk with historical, mythological, and original AI characters — and where a browser agent can create, edit, illustrate, place, and inspect those characters through WebMCP.

**Live application:** https://monde-personnages-ia.nicoco-vu.chatgpt.site/

Built by **Nicolas Vuillier** for the **OpenAI WebMCP Challenge 2026**.

## Why WebMCP matters here

Creating a believable character is not a single form submission. It combines writing, geography, visual direction, relationships, map placement, and editorial review. WebMCP lets the user describe the result in natural language while the agent performs those structured operations directly inside the application.

The interaction stays direct and understandable:

1. the user describes a character;
2. the agent creates it and it appears immediately on the map;
3. the user reviews the text, avatar, location, and relationships;
4. the agent applies requested corrections without recreating the character or its avatar.

## WebMCP tools

| Tool | Purpose |
| --- | --- |
| `list_world_characters` | Lists all visible characters. |
| `get_world_character` | Reads a complete character profile without changing it. |
| `create_world_characters` | Creates, geolocates, and immediately displays up to 20 characters. |
| `update_world_character` | Edits identity, editorial content, response length, coordinates, and targeted relationships while preserving the avatar. |
| `generate_character_avatar` | Generates one historical portrait with FLUX and attaches it to a character. |
| `show_characters_on_map` | Focuses the map on selected characters for visual review. |
| `delete_world_characters` | Permanently removes selected WebMCP characters after explicit user confirmation. |

Targeted relationship changes support `add`, `remove`, and `set_strength`. Character response length can be set to `courte`, `standard`, or `developpee`.

## Demonstrated flow

The contest demonstration uses **Orpheus**, poet of Thrace:

- historically grounded role and mythology;
- placed in the Rhodope Mountains (41.59, 24.69);
- generated historical avatar with his lyre;
- links to Apollo, Dionysus, Jason, Hades, and Persephone;
- immediately visible on the map;
- editable afterwards without recreating the character or avatar.

## Main features

- MapLibre world map with avatar markers and multi-scale clustering.
- Automatic flat OpenStreetMap fallback when WebGL2 is unavailable (including constrained WebMCP browsers), with avatars, pan, zoom, relationships and WebMCP focus preserved.
- Periscope-inspired marker dispatch while zooming.
- Persistent remote characters stored in Cloudflare D1.
- Generated avatar files stored in R2.
- Character conversations powered server-side through OpenRouter.
- Server-enforced limit of 30 chat messages per user and per Paris calendar day.
- Per-character response length and weighted relationship filaments.
- Local character creator with DiceBear fallback avatars.
- Server-side authorization for all WebMCP write operations.
- No user API key is exposed to the browser.

## Technology

- React 19, TypeScript, Next.js/Vinext, Vite
- MapLibre GL and OpenFreeMap
- WebMCP via `document.modelContext.registerTool`
- Cloudflare Workers, D1, and R2
- Drizzle ORM migrations
- Qwen 3.7 Flash through OpenRouter
- FLUX.2 Klein through AI/ML API, with an optional Black Forest Labs fallback

## Local setup

### Requirements

- Node.js 22.13 or newer
- npm
- Linux is recommended for the included build helpers

### Install and run

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite.

The map and built-in characters work without paid API credentials. AI conversations and avatar generation require the corresponding server-side variables in `.env.local`.

### Environment variables

| Variable | Use |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-side character conversations. |
| `AIML_API_KEY` | Server-side FLUX avatar generation through AI/ML API. |
| `BFL_API_KEY` | Optional direct Black Forest Labs fallback. |
| `WEBMCP_ADMIN_EMAILS` | Comma-separated accounts allowed to use write tools. |
| `WEBMCP_PREVIEW_EMAIL` | Optional local-only identity used for WebMCP testing. |

Never commit a populated `.env.local` file or an API key.

## Validation

```bash
npm run build
node --test tests/chat-quota.test.mjs tests/webmcp-tools.test.mjs tests/map-avatar-markers.test.mjs
npm run lint
```

The database schema and generated migrations are stored in `db/` and `drizzle/`.

## Testing WebMCP

Use the application in ChatGPT's in-app browser, which supports WebMCP, or a compatible Chrome build with WebMCP enabled. Ask the agent to list the available tools before starting the demonstration.

Suggested safe test:

> Read Orpheus's complete profile. Do not modify him, generate an image, or publish anything.

Then create a disposable character and demonstrate a direct edit to its response length or relationships.

## Security and human control

- Secrets remain server-side.
- Chat usage is counted atomically in D1 and blocked before the model call after 30 daily messages.
- User identities are hashed before quota records are stored; anonymous visitors receive an HTTP-only device identifier.
- WebMCP write endpoints require an authorized account.
- Generated-image downloads validate protocols, redirects, content type, and size.
- Every write operation requires the authorized WebMCP account and begins with an explicit user instruction.
- Avatar generation is never triggered by an ordinary character edit.

## License

Copyright © 2026 Nicolas Vuillier.

Released under the [MIT License](LICENSE). Third-party dependencies and bundled vendor files retain their own licenses.
