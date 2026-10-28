export type GameStats = {
  score: number;
  lives: number;
  level: number;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleLeft: number;
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
};
