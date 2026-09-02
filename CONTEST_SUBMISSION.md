# WebMCP Challenge submission notes

## Project title

Le Monde des Personnages IA — A world map inhabited by AI characters

## Short description

Le Monde des Personnages IA turns character creation into a human-agent collaboration. A user describes a historical, mythological, or original character in natural language. Through WebMCP, the agent creates a structured draft, writes its role and voice, geolocates it, generates a recognizable avatar, connects it to other characters, and displays it on an interactive world map. The user reviews every result and must explicitly approve publication.

## Why this is a strong fit for WebMCP

The task crosses several interfaces and data types: editorial writing, geographic coordinates, visual generation, graph relationships, map navigation, and publication state. Without WebMCP, an agent would have to guess how to operate the visual interface. With structured tools, it can perform the creative and technical work reliably while the user stays focused on intent and judgment.

## What humans and agents do together

The agent handles structured creation and iteration. The human judges historical credibility, visual identity, geographic placement, and whether the character should become public. This division is essential: the agent accelerates the work, but it cannot bypass editorial approval.

## Implementation summary

The client registers seven tools with `document.modelContext.registerTool`. Read tools inspect the current world and character profiles. Write tools call authenticated server routes that persist drafts in Cloudflare D1 and avatars in R2. Relationship updates are targeted and weighted. Publication requests only open a review dialog; the final publication action remains a human interface action.

## Judge testing instructions

1. Open the live application in ChatGPT's in-app browser or compatible Chrome with WebMCP enabled.
2. Ask the agent to list the world characters.
3. Ask it to read the complete profile of `orphee-5b2f89ba` without modifying anything.
4. Observe Orpheus in the Rhodope Mountains with his generated lyre avatar.
5. For a write demonstration, create a new disposable draft rather than changing Orpheus.
6. Modify the draft's response length or relationships through WebMCP.
7. Ask the agent to show the draft on the map.
8. Ask for publication review and verify that the application waits for human confirmation.

## 90-second demo script

**0–10 seconds — The idea**  
Show the world map and explain that every avatar is a character people can meet and talk with.

**10–25 seconds — Natural-language request**  
In ChatGPT, request one mythological character with a credible role and historically meaningful location.

**25–45 seconds — Structured creation**  
Show WebMCP creating the draft, placing it on the map, and generating one recognizable historical avatar.

**45–62 seconds — Human correction**  
Ask for a more developed response style and strengthen one relationship filament. Show that the existing character and avatar are preserved.

**62–75 seconds — Visual review**  
Ask ChatGPT to focus the map on the character. Zoom in to show the fixed avatar marker and its relationship lines.

**75–90 seconds — Human control**  
Request publication. End on the review dialog and explain that WebMCP prepares the action, but only the user can confirm it.

## Submission checklist

- [ ] Public live URL accessible to judges without the owner's private workspace session, or test credentials supplied in Devpost.
- [ ] Public GitHub, GitLab, or Bitbucket repository.
- [x] Open-source license file.
- [x] Complete source, assets, migrations, and setup instructions.
- [x] WebMCP implementation and human confirmation flow.
- [ ] Public YouTube demo, shorter than three minutes, with English audio or English subtitles.
- [ ] Screenshots added to the Devpost submission.
- [ ] Final English project description copied to Devpost.
