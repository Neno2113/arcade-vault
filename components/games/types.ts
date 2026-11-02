export type GameStat = { label: string; value: string };
export type GameStats = {
  score: number;
  /** null = el juego no tiene vidas. */
  lives: number | null;
  level: number;
  /** Stats propios del juego; el HUD los pinta de forma genérica. */
  extras?: GameStat[];
};
export type EngineCallbacks = {
  onStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
  /** El jugador pidió pausar o reanudar con el teclado; la decisión es de la plataforma. */
  onTogglePause?: () => void;
};
export type GameProps = {
  /** Congela la simulación y el dibujo (se conserva el último frame). */
  paused: boolean;
  /** Cambiar este valor reinicia la partida desde cero (nueva instancia del motor). */
  runId: number;
  /** Se invoca solo cuando algún campo de GameStats cambia, no en cada frame. */
  onStats: (stats: GameStats) => void;
  /** Se invoca una sola vez por partida, al agotarse las vidas. */
  onGameOver: (score: number) => void;
  /** Pide a la plataforma pausar o reanudar; la pausa sigue siendo de GamePlayer. */
  onTogglePause?: () => void;
};
