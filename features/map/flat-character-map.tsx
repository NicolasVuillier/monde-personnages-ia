"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Category, Character } from "@/features/characters/types";
import type { CharacterMapHandle } from "./character-map";
import type { MapThemeId } from "./themes";

type CharacterFilter = "Tous" | Category;

type FlatCharacterMapProps = {
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

type View = { lng: number; lat: number; zoom: number };
type DragState = { pointerId: number; x: number; y: number; view: View; moved: boolean };

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

function clampLatitude(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

function worldSize(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}

function project(lng: number, lat: number, zoom: number) {
  const size = worldSize(zoom);
  const safeLat = clampLatitude(lat);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function unproject(x: number, y: number, zoom: number) {
  const size = worldSize(zoom);
  const lng = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lng: ((lng + 540) % 360) - 180, lat: clampLatitude(lat) };
}

function shortestWorldDelta(value: number, center: number, size: number) {
  let delta = value - center;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function zoomForTargets(characters: Character[]) {
  if (characters.length <= 1) return 11;
  const longitudeSpan = Math.max(...characters.map((item) => item.lng)) - Math.min(...characters.map((item) => item.lng));
  const latitudeSpan = Math.max(...characters.map((item) => item.lat)) - Math.min(...characters.map((item) => item.lat));
  const span = Math.max(longitudeSpan, latitudeSpan * 1.7, 0.02);
  return Math.max(MIN_ZOOM, Math.min(8, Math.floor(Math.log2(240 / span))));
}

export const FlatCharacterMap = forwardRef<CharacterMapHandle, FlatCharacterMapProps>(
  function FlatCharacterMap(
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
    },
    forwardedRef,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const [view, setView] = useState<View>({ lng: 12, lat: 27, zoom: MIN_ZOOM });

    useEffect(() => {
      onError(null);
      onReady();
    }, [onError, onReady]);

    useImperativeHandle(forwardedRef, () => ({
      focusCharacter(character) {
        setView((current) => ({ lng: character.lng, lat: character.lat, zoom: Math.max(current.zoom, 11) }));
      },
      focusCharacters(targets) {
        if (targets.length === 0) return;
        setView({
          lng: targets.reduce((sum, item) => sum + item.lng, 0) / targets.length,
          lat: targets.reduce((sum, item) => sum + item.lat, 0) / targets.length,
          zoom: zoomForTargets(targets),
        });
      },
      resetWorld() {
        setView({ lng: 12, lat: 27, zoom: MIN_ZOOM });
      },
    }), []);

    const visibleCharacters = useMemo(() => {
      const filtered = activeFilter === "Tous"
        ? characters
        : characters.filter((character) => character.category === activeFilter);
      return filtered.slice(0, 220);
    }, [activeFilter, characters]);

    const centerPoint = project(view.lng, view.lat, view.zoom);
    const tileRadius = 3;
    const centerTileX = Math.floor(centerPoint.x / TILE_SIZE);
    const centerTileY = Math.floor(centerPoint.y / TILE_SIZE);
    const tileCount = 2 ** view.zoom;
    const tiles = [] as Array<{ key: string; x: number; y: number; left: number; top: number }>;
    for (let xOffset = -tileRadius; xOffset <= tileRadius; xOffset += 1) {
      for (let yOffset = -tileRadius; yOffset <= tileRadius; yOffset += 1) {
        const rawX = centerTileX + xOffset;
        const rawY = centerTileY + yOffset;
        if (rawY < 0 || rawY >= tileCount) continue;
        tiles.push({
          key: `${view.zoom}:${rawX}:${rawY}`,
          x: ((rawX % tileCount) + tileCount) % tileCount,
          y: rawY,
          left: rawX * TILE_SIZE - centerPoint.x,
          top: rawY * TILE_SIZE - centerPoint.y,
        });
      }
    }

    const markerPositions = visibleCharacters.map((character) => {
      const point = project(character.lng, character.lat, view.zoom);
      return {
        character,
        left: shortestWorldDelta(point.x, centerPoint.x, worldSize(view.zoom)),
        top: point.y - centerPoint.y,
      };
    });

    const selected = characters.find((character) => character.id === selectedId);
    const selectedPosition = markerPositions.find((item) => item.character.id === selectedId);
    const relationshipLines = selected && selectedPosition
      ? selected.relations.flatMap((relationId) => {
          const target = markerPositions.find((item) => item.character.id === relationId);
          if (!target) return [];
          const dx = target.left - selectedPosition.left;
          const dy = target.top - selectedPosition.top;
          return [{
            id: relationId,
            left: selectedPosition.left,
            top: selectedPosition.top,
            width: Math.sqrt(dx * dx + dy * dy),
            angle: Math.atan2(dy, dx) * 180 / Math.PI,
            strength: selected.relationStrengths?.[relationId] ?? 0.6,
          }];
        })
      : [];

    const updateZoom = (change: number) => {
      setView((current) => ({ ...current, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom + change)) }));
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isPlacingCharacter || event.button !== 0) return;
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      const origin = project(drag.view.lng, drag.view.lat, drag.view.zoom);
      const next = unproject(origin.x - dx, origin.y - dy, drag.view.zoom);
      setView({ ...next, zoom: drag.view.zoom });
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!isPlacingCharacter || drag.moved || !containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const point = unproject(
        centerPoint.x + event.clientX - bounds.left - bounds.width / 2,
        centerPoint.y + event.clientY - bounds.top - bounds.height / 2,
        view.zoom,
      );
      onPlacement(point.lng, point.lat);
    };

    const handlePlacement = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPlacingCharacter || !containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const point = unproject(
        centerPoint.x + event.clientX - bounds.left - bounds.width / 2,
        centerPoint.y + event.clientY - bounds.top - bounds.height / 2,
        view.zoom,
      );
      onPlacement(point.lng, point.lat);
    };

    return (
      <div
        ref={containerRef}
        className={`flat-map flat-map--${theme}${isPlacingCharacter ? " is-placing" : ""}`}
        aria-label="Carte 2D des personnages"
        role="region"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={isPlacingCharacter ? handlePlacement : handlePointerUp}
      >
        <div className="flat-map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={`https://tile.openstreetmap.org/${view.zoom}/${tile.x}/${tile.y}.png`}
              alt=""
              draggable={false}
              style={{ transform: `translate(calc(50% + ${tile.left}px), calc(50% + ${tile.top}px))` }}
            />
          ))}
        </div>

        <div className="flat-map-relations" aria-hidden="true">
          {relationshipLines.map((line) => (
            <i
              key={line.id}
              style={{
                left: `calc(50% + ${line.left}px)`,
                top: `calc(50% + ${line.top}px)`,
                width: `${line.width}px`,
                opacity: 0.25 + line.strength * 0.6,
                transform: `rotate(${line.angle}deg)`,
              }}
            />
          ))}
        </div>

        <div className="flat-map-markers">
          {markerPositions.map(({ character, left, top }) => (
            <button
              key={character.id}
              type="button"
              className={`flat-character-marker${character.id === selectedId ? " is-selected" : ""}`}
              style={{
                left: `calc(50% + ${left}px)`,
                top: `calc(50% + ${top}px)`,
                "--marker-color": character.color,
              } as React.CSSProperties}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onCharacterOpen(character.id)}
              aria-label={`Ouvrir ${character.name}`}
            >
              <img src={character.avatar} alt="" />
              <span>{character.name}</span>
            </button>
          ))}
        </div>

        <div className="flat-map-controls" aria-label="Contrôles de la carte">
          <button type="button" onClick={() => updateZoom(1)} aria-label="Zoomer">+</button>
          <button type="button" onClick={() => updateZoom(-1)} aria-label="Dézoomer">−</button>
        </div>
        <span className="flat-map-attribution">© OpenStreetMap contributors · mode compatible</span>
      </div>
    );
  },
);
