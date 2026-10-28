'use client';
import { useEffect, useRef } from 'react';
import { AsteroidsEngine } from '@/lib/games/asteroids/engine';
import type { GameProps } from './types';
export function AsteroidsGame({
  paused,
  runId,
  onStats,
  onGameOver,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onStats, onGameOver });
  useEffect(() => {
    pausedRef.current = paused;
    callbacksRef.current = { onStats, onGameOver };
  });
  // Una instancia nueva del motor por partida (runId); destroy() limpia rAF y listeners.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new AsteroidsEngine(canvas, {
      onStats: (stats) => callbacksRef.current.onStats(stats),
      onGameOver: (score) => callbacksRef.current.onGameOver(score),
    });
    engine.setPaused(pausedRef.current);
    engine.start();
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [runId]);
  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused, runId]);
  return (
    <canvas ref={canvasRef} className="game-canvas" width={800} height={600} />
  );
}
