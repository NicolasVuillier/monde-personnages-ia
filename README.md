# Le Monde des Personnages IA

An interactive world map where people can discover and talk with historical, mythological, and original AI characters — and where a browser agent can create, edit, illustrate, place, inspect, and prepare those characters for publication through WebMCP.

**Live application:** https://monde-personnages-ia.nicoco-vu.chatgpt.site/

Built by **Nicolas Vuillier** for the **OpenAI WebMCP Challenge 2026**.

## Why WebMCP matters here

Creating a believable character is not a single form submission. It combines writing, geography, visual direction, relationships, map placement, and editorial review. WebMCP lets the user describe the result in natural language while the agent performs those structured operations directly inside the application.

The application keeps the human in control:

1. the agent creates a draft;
2. the draft appears on the map;
3. the user reviews the text, avatar, location, and relationships;
4. the agent can apply requested corrections without recreating the character;
5. publication always requires an explicit human confirmation in the interface.

## WebMCP tools

| Tool | Purpose |
| --- | --- |
| `list_world_characters` | Lists visible characters and drafts. |
| `get_world_character` | Reads a complete character profile without changing it. |
| `create_character_drafts` | Creates and geolocates up to 20 drafts. |
| `update_world_character` | Edits identity, editorial content, response length, coordinates, and targeted relationships while preserving the avatar. |
| `generate_character_avatar` | Generates one historical portrait with FLUX and attaches it to a draft. |
| `show_characters_on_map` | Focuses the map on selected characters for visual review. |
| `request_publish_characters` | Opens the human publication review; it never publishes by itself. |

Targeted relationship changes support `add`, `remove`, and `set_strength`. Character response length can be set to `courte`, `standard`, or `developpee`.

## Demonstrated flow

The contest demonstration uses **Orpheus**, poet of Thrace:

- historically grounded role and mythology;
- placed in the Rhodope Mountains (41.59, 24.69);
- generated historical avatar with his lyre;
- links to Apollo, Dionysus, Jason, Hades, and Persephone;
- draft visible on the map;
- human confirmation required before publication.

## Main features

- MapLibre world map with avatar markers and multi-scale clustering.
- Periscope-inspired marker dispatch while zooming.
- Persistent remote characters stored in Cloudflare D1.
- Generated avatar files stored in R2.
- Character conversations powered server-side through OpenRouter.
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
node --test tests/webmcp-tools.test.mjs tests/map-avatar-markers.test.mjs
npm run lint
```

The database schema and generated migrations are stored in `db/` and `drizzle/`.

## Testing WebMCP

Use the application in ChatGPT's in-app browser, which supports WebMCP, or a compatible Chrome build with WebMCP enabled. Ask the agent to list the available tools before starting the demonstration.

Suggested safe test:

> Read Orpheus's complete profile. Do not modify him, generate an image, or publish anything.

Then demonstrate a reversible edit on a disposable draft before opening the human publication review.

## Security and human control

- Secrets remain server-side.
- WebMCP write endpoints require an authorized account.
- Generated-image downloads validate protocols, redirects, content type, and size.
- Publication is separated from the agent request and requires a human interface action.
- Avatar generation is never triggered by an ordinary character edit.

## License

Copyright © 2026 Nicolas Vuillier.

Released under the [MIT License](LICENSE). Third-party dependencies and bundled vendor files retain their own licenses.
