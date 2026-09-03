"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { FeatureCollection, LineString, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Category, Character } from "@/features/characters/types";
import { stylizeWorldMap, type MapThemeId } from "./themes";
import { FlatCharacterMap } from "./flat-character-map";

type CharacterFilter = "Tous" | Category;

type CharacterMapProps = {
  characters: Character[];
  activeFilter: CharacterFilter;
  selectedId: string;
  theme: MapThemeId;
  isPlacingCharacter: boolean;
  onCharacterOpen: (id: string) => void;
  onPlacement: (lng: number, lat: number) => void;
  onReady: () => void;
  onError: (message: string | null) => void;
};

export type CharacterMapHandle = {
  focusCharacter: (character: Character, allCharacters: Character[]) => void;
  focusCharacters: (characters: Character[]) => void;
  resetWorld: () => void;
};

const EMPTY_LINES: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_MARKERS: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

export type CharacterMarkerBand = "world" | "region" | "local" | "individual";

export type CharacterMarkerDescriptor = {
  key: string;
  band: CharacterMarkerBand;
  representative: Character;
  memberIds: string[];
  count: number;
  coordinates: [number, number];
};

type MarkerDispatchState = {
  coordinates: [number, number];
  progress: number;
};

type MarkerBandConfig = {
  band: CharacterMarkerBand;
  longitudeStep: number;
  latitudeStep: number;
};

function markerBand(zoom: number): MarkerBandConfig {
  if (zoom < 3.2) return { band: "world", longitudeStep: 20, latitudeStep: 20 };
  if (zoom < 5.8) return { band: "region", longitudeStep: 8, latitudeStep: 6 };
  if (zoom < 8.7) return { band: "local", longitudeStep: 2.5, latitudeStep: 2 };
  return { band: "individual", longitudeStep: 0, latitudeStep: 0 };
}

function representativeScore(character: Character): number {
  const avatarBonus = character.avatar.startsWith("/api/avatars/")
    ? 12
    : character.avatar.startsWith("/avatars/")
      ? 8
      : 0;
  return character.popularity * 100 + avatarBonus;
}

function isPreferredRepresentative(candidate: Character, current: Character): boolean {
  const scoreDifference = representativeScore(candidate) - representativeScore(current);
  if (scoreDifference !== 0) return scoreDifference > 0;
  return candidate.id.localeCompare(current.id, "fr") < 0;
}

export function buildCharacterMarkerDescriptors(
  characters: Character[],
  activeFilter: CharacterFilter,
  zoom: number,
): CharacterMarkerDescriptor[] {
  const visible = activeFilter === "Tous"
    ? characters
    : characters.filter((character) => character.category === activeFilter);
  const config = markerBand(zoom);

  if (config.band === "individual") {
    return visible.map((character) => ({
      key: `character:${character.id}`,
      band: config.band,
      representative: character,
      memberIds: [character.id],
      count: 1,
      coordinates: [character.lng, character.lat],
    }));
  }

  const groups = new Map<string, { representative: Character; memberIds: string[]; count: number }>();
  for (const character of visible) {
    const longitudeCell = Math.floor((character.lng + 180) / config.longitudeStep);
    const latitudeCell = Math.floor((character.lat + 90) / config.latitudeStep);
    const key = `${config.band}:${longitudeCell}:${latitudeCell}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { representative: character, memberIds: [character.id], count: 1 });
      continue;
    }
    group.count += 1;
    group.memberIds.push(character.id);
    if (isPreferredRepresentative(character, group.representative)) {
      group.representative = character;
    }
  }

  return [...groups.entries()].map(([key, group]) => {
    return {
      key: `group:${key}`,
      band: config.band,
      representative: group.representative,
      memberIds: group.memberIds,
      count: group.count,
      coordinates: [group.representative.lng, group.representative.lat],
    };
  });
}

export function buildCharacterDispatchOrigins(
  previous: CharacterMarkerDescriptor[],
  next: CharacterMarkerDescriptor[],
): Map<string, [number, number]> {
  const origins = new Map<string, [number, number]>();
  for (const descriptor of next) {
    const parent = previous.find((candidate) => candidate.memberIds.includes(descriptor.representative.id));
    origins.set(descriptor.key, parent?.coordinates ?? descriptor.coordinates);
  }
  return origins;
}

export function buildDispatchRenderDescriptors(
  previous: CharacterMarkerDescriptor[],
  next: CharacterMarkerDescriptor[],
  visibleNext: CharacterMarkerDescriptor[],
  limit = 220,
): CharacterMarkerDescriptor[] {
  if (previous.length === 0) return visibleNext.slice(0, limit);

  const previousMemberIds = new Set(previous.flatMap((descriptor) => descriptor.memberIds));
  const retained = new Map<string, CharacterMarkerDescriptor>();

  // Keep every child of the groups that were visible before the zoom. Some of
  // their final coordinates can sit just outside the new viewport: retaining
  // them here lets MapLibre animate them out instead of making them vanish.
  for (const descriptor of next) {
    if (previousMemberIds.has(descriptor.representative.id)) {
      retained.set(descriptor.key, descriptor);
    }
  }
  for (const descriptor of visibleNext) {
    retained.set(descriptor.key, descriptor);
  }

  return [...retained.values()].slice(0, limit);
}

function markerBandRank(band: CharacterMarkerBand): number {
  return band === "world" ? 0 : band === "region" ? 1 : band === "local" ? 2 : 3;
}

function interpolateCoordinates(
  from: [number, number],
  to: [number, number],
  progress: number,
): [number, number] {
  let longitudeDelta = to[0] - from[0];
  if (longitudeDelta > 180) longitudeDelta -= 360;
  if (longitudeDelta < -180) longitudeDelta += 360;
  return [
    from[0] + longitudeDelta * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

function avatarImageId(character: Character): string {
  let hash = 2166136261;
  const value = `${character.id}|${character.avatar}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `character-avatar-${character.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${(hash >>> 0).toString(36)}`;
}

function drawAvatarBadge(
  character: Character,
  image?: HTMLImageElement,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Le portrait ne peut pas être préparé sur cet appareil.");

  context.clearRect(0, 0, 96, 96);
  context.beginPath();
  context.arc(48, 48, 44, 0, Math.PI * 2);
  context.fillStyle = character.color;
  context.fill();

  context.save();
  context.beginPath();
  context.arc(48, 48, 38, 0, Math.PI * 2);
  context.clip();
  if (image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const scale = Math.max(76 / width, 76 / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    context.drawImage(image, 48 - drawWidth / 2, 48 - drawHeight / 2, drawWidth, drawHeight);
  } else {
    context.fillStyle = "#17322b";
    context.fillRect(10, 10, 76, 76);
    context.fillStyle = "#ffffff";
    context.font = "800 42px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(character.name.trim().slice(0, 1).toLocaleUpperCase("fr"), 48, 50);
  }
  context.restore();

  context.beginPath();
  context.arc(48, 48, 40.5, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,255,255,.94)";
  context.lineWidth = 5;
  context.stroke();
  return context.getImageData(0, 0, 96, 96);
}

function loadAvatarImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Avatar indisponible"));
    image.src = url;
  });
}

function markerData(
  descriptors: CharacterMarkerDescriptor[],
  selectedMarkerKey: string | undefined,
  dispatchState?: Map<string, MarkerDispatchState>,
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: descriptors.map((descriptor) => {
      const state = dispatchState?.get(descriptor.key);
      return {
        type: "Feature",
        id: descriptor.key,
        properties: {
          key: descriptor.key,
          id: descriptor.representative.id,
          name: descriptor.representative.name,
          color: descriptor.representative.color,
          icon: avatarImageId(descriptor.representative),
          band: descriptor.band,
          count: descriptor.count,
          countLabel: descriptor.count > 999
            ? `${Math.round(descriptor.count / 100) / 10}k`
            : String(descriptor.count),
          selected: descriptor.key === selectedMarkerKey ? 1 : 0,
          progress: state?.progress ?? 1,
        },
        geometry: {
          type: "Point",
          coordinates: state?.coordinates ?? descriptor.coordinates,
        },
      };
    }),
  };
}

function relationshipData(
  character: Character,
  characters: Character[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: character.relations
      .map((relationId) => characters.find((item) => item.id === relationId))
      .filter((item): item is Character => Boolean(item))
      .map((related) => ({
        type: "Feature",
        properties: {
          strength: character.relationStrengths?.[related.id] ?? 0.6,
        },
        geometry: {
          type: "LineString",
          coordinates: [[character.lng, character.lat], [related.lng, related.lat]],
        },
      })),
  };
}

type MapLibreCharacterMapProps = CharacterMapProps & {
  onFallback: () => void;
};

const MapLibreCharacterMap = forwardRef<CharacterMapHandle, MapLibreCharacterMapProps>(
  function CharacterMap(
    {
      characters,
      activeFilter,
      selectedId,
      theme,
      isPlacingCharacter,
      onCharacterOpen,
      onPlacement,
      onReady,
      onError,
      onFallback,
    },
    forwardedRef,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const renderMarkersRef = useRef<(() => void) | null>(null);
    const avatarLoadsRef = useRef<Map<string, Promise<void>>>(new Map());
    const readyRef = useRef(false);
    const charactersRef = useRef(characters);
    const filterRef = useRef(activeFilter);
    const selectedRef = useRef(selectedId);
    const themeRef = useRef(theme);
    const placingRef = useRef(isPlacingCharacter);
    const openRef = useRef(onCharacterOpen);
    const placementRef = useRef(onPlacement);
    const readyCallbackRef = useRef(onReady);
    const errorCallbackRef = useRef(onError);
    const fallbackCallbackRef = useRef(onFallback);

    charactersRef.current = characters;
    filterRef.current = activeFilter;
    selectedRef.current = selectedId;
    themeRef.current = theme;
    placingRef.current = isPlacingCharacter;
    openRef.current = onCharacterOpen;
    placementRef.current = onPlacement;
    readyCallbackRef.current = onReady;
    errorCallbackRef.current = onError;
    fallbackCallbackRef.current = onFallback;

    useImperativeHandle(forwardedRef, () => ({
      focusCharacter(character, allCharacters) {
        const map = mapRef.current;
        if (!map || !readyRef.current) return;
        map.flyTo({
          center: [character.lng, character.lat],
          zoom: Math.max(map.getZoom(), 11),
          duration: 1100,
          essential: true,
        });
        const source = map.getSource("relationships") as GeoJSONSource | undefined;
        source?.setData(relationshipData(character, allCharacters));
      },
      focusCharacters(targets) {
        const map = mapRef.current;
        if (!map || !readyRef.current || targets.length === 0) return;
        if (targets.length === 1) {
          map.flyTo({
            center: [targets[0].lng, targets[0].lat],
            zoom: Math.max(map.getZoom(), 8),
            duration: 1000,
            essential: true,
          });
          return;
        }
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...targets.map((character) => character.lng)), Math.min(...targets.map((character) => character.lat))],
          [Math.max(...targets.map((character) => character.lng)), Math.max(...targets.map((character) => character.lat))],
        ];
        map.fitBounds(bounds, { padding: 90, maxZoom: 8, duration: 1200, essential: true });
      },
      resetWorld() {
        const map = mapRef.current;
        if (!map || !readyRef.current) return;
        map.flyTo({ center: [12, 27], zoom: 1.65, duration: 1400, essential: true });
        const source = map.getSource("relationships") as GeoJSONSource | undefined;
        source?.setData(EMPTY_LINES);
      },
    }), []);

    useEffect(() => {
      let cancelled = false;
      let hasLoaded = false;
      let loadTimer: number | undefined;
      let dispatchFrame: number | undefined;
      let currentMarkerBand: CharacterMarkerBand | undefined;
      let previousDescriptors: CharacterMarkerDescriptor[] = [];

      async function initializeMap() {
        if (!containerRef.current || mapRef.current) return;
        let maplibregl: typeof import("maplibre-gl");
        let map: MapLibreMap;
        try {
          maplibregl = await import("maplibre-gl");
          if (cancelled || !containerRef.current) return;
          map = new maplibregl.Map({
            container: containerRef.current,
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: [12, 27],
            zoom: 1.65,
            minZoom: 1.25,
            maxZoom: 20,
            attributionControl: false,
          });
        } catch {
          if (!cancelled) fallbackCallbackRef.current();
          return;
        }

        mapRef.current = map;
        loadTimer = window.setTimeout(() => {
          if (!hasLoaded) {
            errorCallbackRef.current("La carte met trop longtemps à répondre sur cet appareil.");
          }
        }, 12000);

        map.addControl(
          new maplibregl.AttributionControl({ compact: true, customAttribution: "Carte OpenFreeMap" }),
          "bottom-right",
        );
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        map.on("load", () => {
          hasLoaded = true;
          if (loadTimer) window.clearTimeout(loadTimer);
          errorCallbackRef.current(null);
          map.setProjection({ type: "globe" });
          stylizeWorldMap(map, themeRef.current);

          map.addSource("relationships", {
            type: "geojson",
            data: EMPTY_LINES,
          });
          map.addLayer({
            id: "relationship-glow",
            type: "line",
            source: "relationships",
            paint: {
              "line-color": "#9fffe0",
              "line-width": ["interpolate", ["linear"], ["get", "strength"], 0.2, 3.5, 1, 7.5],
              "line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0.2, 0.1, 1, 0.25],
              "line-blur": 4,
            },
          });
          map.addLayer({
            id: "relationship-lines",
            type: "line",
            source: "relationships",
            paint: {
              "line-color": "#baffec",
              "line-width": ["interpolate", ["linear"], ["get", "strength"], 0.2, 0.8, 1, 2.2],
              "line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0.2, 0.4, 1, 0.9],
              "line-dasharray": [2, 2],
            },
          });

          map.addSource("character-avatars", {
            type: "geojson",
            data: EMPTY_MARKERS,
          });
          map.addLayer({
            id: "character-avatar-glow",
            type: "circle",
            source: "character-avatars",
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": [
                "*",
                [
                  "match", ["get", "band"],
                  "world", 34,
                  "region", 31,
                  "local", 28,
                  25,
                ],
                ["interpolate", ["linear"], ["get", "progress"], 0, 0.86, 1, 1],
              ],
              "circle-opacity": [
                "*",
                0.22,
                ["interpolate", ["linear"], ["get", "progress"], 0, 0.72, 1, 1],
              ],
              "circle-blur": 0.55,
              "circle-pitch-alignment": "viewport",
            },
          });
          map.addLayer({
            id: "character-avatar-selected",
            type: "circle",
            source: "character-avatars",
            filter: ["==", ["get", "selected"], 1],
            paint: {
              "circle-color": "rgba(0,0,0,0)",
              "circle-radius": [
                "*",
                [
                  "match", ["get", "band"],
                  "world", 32,
                  "region", 29,
                  "local", 26,
                  23,
                ],
                ["interpolate", ["linear"], ["get", "progress"], 0, 0.86, 1, 1],
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 3,
              "circle-pitch-alignment": "viewport",
            },
          });
          map.addLayer({
            id: "character-avatar-images",
            type: "symbol",
            source: "character-avatars",
            layout: {
              "icon-image": ["get", "icon"],
              "icon-size": [
                "*",
                [
                  "match", ["get", "band"],
                  "world", 1.25,
                  "region", 1.12,
                  "local", 1,
                  0.92,
                ],
                ["interpolate", ["linear"], ["get", "progress"], 0, 0.86, 1, 1],
              ],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-pitch-alignment": "viewport",
              "icon-rotation-alignment": "viewport",
              "symbol-sort-key": ["get", "selected"],
            },
          });
          map.addLayer({
            id: "character-avatar-counts",
            type: "symbol",
            source: "character-avatars",
            filter: [">", ["get", "count"], 1],
            layout: {
              "text-field": ["get", "countLabel"],
              "text-size": 10,
              "text-font": ["Noto Sans Bold"],
              "text-offset": [1.65, -1.65],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#09241e",
              "text-halo-color": "rgba(255,255,255,.96)",
              "text-halo-width": 5,
              "text-halo-blur": 0.5,
              "text-opacity": ["get", "progress"],
            },
          });
          map.addLayer({
            id: "character-avatar-labels",
            type: "symbol",
            source: "character-avatars",
            layout: {
              "text-field": ["get", "name"],
              "text-size": 10,
              "text-font": ["Noto Sans Regular"],
              "text-offset": [0, 3.35],
              "text-anchor": "top",
              "text-optional": true,
              "text-padding": 7,
            },
            paint: {
              "text-color": "#f2fff9",
              "text-halo-color": "rgba(3,10,8,.92)",
              "text-halo-width": 2,
              "text-opacity": ["get", "progress"],
            },
          });
          map.addLayer({
            id: "character-avatar-hit",
            type: "circle",
            source: "character-avatars",
            paint: {
              "circle-radius": [
                "match", ["get", "band"],
                "world", 32,
                "region", 29,
                "local", 26,
                23,
              ],
              "circle-opacity": 0,
              "circle-pitch-alignment": "viewport",
            },
          });

          const syncCharacterMarkers = () => {
            const descriptors = buildCharacterMarkerDescriptors(
              charactersRef.current,
              filterRef.current,
              map.getZoom(),
            );
            const bounds = map.getBounds();
            const visibleDescriptors = descriptors
              .filter((descriptor) => descriptor.band !== "individual" || bounds.contains(descriptor.coordinates))
              .slice(0, 220);
            const nextBand = descriptors[0]?.band ?? markerBand(map.getZoom()).band;
            const isDeeperBand = currentMarkerBand !== undefined
              && markerBandRank(nextBand) > markerBandRank(currentMarkerBand);
            const renderedDescriptors = isDeeperBand
              ? buildDispatchRenderDescriptors(previousDescriptors, descriptors, visibleDescriptors)
              : visibleDescriptors;
            const selectedCharacter = charactersRef.current.find((character) => character.id === selectedRef.current);
            const selectedMarkerKey = selectedCharacter
              ? buildCharacterMarkerDescriptors([selectedCharacter], filterRef.current, map.getZoom())[0]?.key
              : undefined;
            for (const descriptor of renderedDescriptors) {
              const character = descriptor.representative;
              const imageId = avatarImageId(character);
              if (!map.hasImage(imageId)) {
                map.addImage(imageId, drawAvatarBadge(character), { pixelRatio: 2 });
              }
              if (!avatarLoadsRef.current.has(imageId)) {
                const load = loadAvatarImage(character.avatar)
                  .then((image) => {
                    if (!cancelled && map.hasImage(imageId)) {
                      map.updateImage(imageId, drawAvatarBadge(character, image));
                    }
                  })
                  .catch(() => undefined);
                avatarLoadsRef.current.set(imageId, load);
              }
            }

            const source = map.getSource("character-avatars") as GeoJSONSource | undefined;
            if (!source) return;

            if (dispatchFrame !== undefined && nextBand === currentMarkerBand) return;
            if (dispatchFrame !== undefined) {
              window.cancelAnimationFrame(dispatchFrame);
              dispatchFrame = undefined;
            }

            const origins = buildCharacterDispatchOrigins(previousDescriptors, renderedDescriptors);
            const movingApart = renderedDescriptors.some((descriptor) => {
              const origin = origins.get(descriptor.key) ?? descriptor.coordinates;
              return Math.abs(origin[0] - descriptor.coordinates[0]) > 0.00001
                || Math.abs(origin[1] - descriptor.coordinates[1]) > 0.00001;
            });
            const shouldDispatch = previousDescriptors.length > 0
              && currentMarkerBand !== undefined
              && markerBandRank(nextBand) > markerBandRank(currentMarkerBand)
              && movingApart
              && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            previousDescriptors = renderedDescriptors;
            currentMarkerBand = nextBand;
            if (!shouldDispatch) {
              source.setData(markerData(renderedDescriptors, selectedMarkerKey));
              return;
            }

            const startedAt = performance.now();
            const duration = 560;
            const animateDispatch = (now: number) => {
              if (cancelled) return;
              const linearProgress = Math.min((now - startedAt) / duration, 1);
              const easedProgress = 1 - Math.pow(1 - linearProgress, 3);
              const state = new Map<string, MarkerDispatchState>();
              for (const descriptor of renderedDescriptors) {
                const origin = origins.get(descriptor.key) ?? descriptor.coordinates;
                state.set(descriptor.key, {
                  coordinates: interpolateCoordinates(origin, descriptor.coordinates, easedProgress),
                  progress: easedProgress,
                });
              }
              source.setData(markerData(renderedDescriptors, selectedMarkerKey, state));
              if (linearProgress < 1) {
                dispatchFrame = window.requestAnimationFrame(animateDispatch);
              } else {
                dispatchFrame = undefined;
              }
            };
            dispatchFrame = window.requestAnimationFrame(animateDispatch);
          };

          const markerClick = (event: MapLayerMouseEvent) => {
            if (placingRef.current) return;
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;
            const id = feature.properties?.id;
            const band = feature.properties?.band as CharacterMarkerBand | undefined;
            if (typeof id !== "string" || !band) return;
            if (band === "individual") {
              openRef.current(id);
              return;
            }
            const [lng, lat] = feature.geometry.coordinates;
            const zoomGain = band === "world" ? 2.2 : band === "region" ? 1.9 : 1.5;
            map.easeTo({
              center: [lng, lat],
              zoom: Math.min(map.getZoom() + zoomGain, 9.2),
              duration: 720,
              essential: true,
            });
          };
          const usePointer = () => {
            if (!placingRef.current) map.getCanvas().style.cursor = "pointer";
          };
          const clearPointer = () => {
            map.getCanvas().style.cursor = placingRef.current ? "crosshair" : "";
          };

          renderMarkersRef.current = syncCharacterMarkers;
          map.on("zoomend", syncCharacterMarkers);
          map.on("moveend", syncCharacterMarkers);
          map.on("click", "character-avatar-hit", markerClick);
          map.on("mouseenter", "character-avatar-hit", usePointer);
          map.on("mouseleave", "character-avatar-hit", clearPointer);
          syncCharacterMarkers();
          map.on("click", (event) => {
            if (!placingRef.current) return;
            placementRef.current(
              Number(event.lngLat.lng.toFixed(5)),
              Number(event.lngLat.lat.toFixed(5)),
            );
          });

          readyRef.current = true;
          readyCallbackRef.current();
        });

        map.on("error", (event) => {
          if (!hasLoaded && /webgl|gpu|context/i.test(String(event.error?.message ?? ""))) {
            fallbackCallbackRef.current();
          }
        });
      }

      initializeMap();
      return () => {
        cancelled = true;
        readyRef.current = false;
        if (loadTimer) window.clearTimeout(loadTimer);
        if (dispatchFrame !== undefined) window.cancelAnimationFrame(dispatchFrame);
        renderMarkersRef.current = null;
        avatarLoadsRef.current.clear();
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!readyRef.current) return;
      renderMarkersRef.current?.();
    }, [characters, activeFilter]);

    useEffect(() => {
      const map = mapRef.current;
      if (!readyRef.current || !map) return;
      stylizeWorldMap(map, theme);
    }, [theme]);

    useEffect(() => {
      if (!readyRef.current) return;
      renderMarkersRef.current?.();
    }, [selectedId]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      map.getCanvas().style.cursor = isPlacingCharacter ? "crosshair" : "";
    }, [isPlacingCharacter]);

    return (
      <div
        ref={containerRef}
        className={`world-map${isPlacingCharacter ? " is-placing" : ""}`}
        aria-label="Carte mondiale interactive des personnages"
      />
    );
  },
);

function hasWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

export const CharacterMap = forwardRef<CharacterMapHandle, CharacterMapProps>(
  function CharacterMap(props, forwardedRef) {
    const [mode, setMode] = useState<"checking" | "maplibre" | "flat">("checking");

    useEffect(() => {
      setMode(hasWebGL2() ? "maplibre" : "flat");
    }, []);

    if (mode === "checking") return <div className="map-canvas" aria-hidden="true" />;
    if (mode === "flat") return <FlatCharacterMap ref={forwardedRef} {...props} />;
    return <MapLibreCharacterMap ref={forwardedRef} {...props} onFallback={() => setMode("flat")} />;
  },
);
