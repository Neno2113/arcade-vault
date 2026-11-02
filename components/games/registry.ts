import type { ComponentType } from 'react';
import { AsteroidsGame } from './asteroids-game';
import { BloqueBusterGame } from './bloque-buster-game';
import { CaidaGame } from './caida-game';
import { SerpentinaGame } from './serpentina-game';
import type { GameProps } from './types';
export type GameEntry = {
  Component: ComponentType<GameProps>;
  controls: string;
  /** Vidas del primer render, antes del primer onStats; null = sin vidas. */
  initialLives: number | null;
};
export const GAME_REGISTRY: Record<string, GameEntry> = {
  rocas: {
    Component: AsteroidsGame,
    controls: '← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR',
    initialLives: 3,
  },
  caida: {
    Component: CaidaGame,
    controls: '← → MOVER · ↓ BAJAR · ↑ X ROTAR · ESPACIO CAÍDA · P PAUSA',
    initialLives: null,
  },
  'bloque-buster': {
    Component: BloqueBusterGame,
    controls: '← → A D MOVER · ESPACIO LANZAR · P PAUSA',
    initialLives: 3,
  },
  serpentina: {
    Component: SerpentinaGame,
    controls: '← ↑ ↓ → WASD MOVER · P PAUSA',
    initialLives: null,
  },
};
