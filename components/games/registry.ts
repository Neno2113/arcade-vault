import type { ComponentType } from 'react';
import { AsteroidsGame } from './asteroids-game';
import { CaidaGame } from './caida-game';
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
};
