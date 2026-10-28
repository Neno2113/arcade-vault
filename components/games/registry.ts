import type { ComponentType } from 'react';
import { AsteroidsGame } from './asteroids-game';
import type { GameProps } from './types';
export type GameEntry = {
  Component: ComponentType<GameProps>;
  controls: string;
};
export const GAME_REGISTRY: Record<string, GameEntry> = {
  rocas: {
    Component: AsteroidsGame,
    controls: '← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR',
  },
};
