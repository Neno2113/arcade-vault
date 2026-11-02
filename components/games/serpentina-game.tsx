'use client';
import { useEffect, useRef } from 'react';
import { SerpentinaEngine } from '@/lib/games/serpentina/engine';
import type { GameProps } from './types';
export function SerpentinaGame({
  paused,
  runId,
  onStats,
  onGameOver,
  onTogglePause,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SerpentinaEngine | null>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef({ onStats, onGameOver, onTogglePause });
  useEffect(() => {
    pausedRef.current = paused;
    callbacksRef.current = { onStats, onGameOver, onTogglePause };
  });
  // Una instancia nueva del motor por partida (runId); destroy() limpia rAF, temporizador y listeners.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SerpentinaEngine(canvas, {
      onStats: (stats) => callbacksRef.current.onStats(stats),
      onGameOver: (score) => callbacksRef.current.onGameOver(score),
      onTogglePause: () => callbacksRef.current.onTogglePause?.(),
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
  return <canvas ref={canvasRef} className="game-canvas" width={800} height={600} />;
}
