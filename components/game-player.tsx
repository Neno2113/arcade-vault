'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Game } from '@/lib/types';
import { GAME_REGISTRY } from './games/registry';
import type { GameStats } from './games/types';
import { saveScore } from '@/app/juegos/[id]/jugar/actions';
import { useSession } from './session-provider';
const LEVEL_STEP = 2500;
const LIVES = 3;
export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [lives, setLives] = useState(LIVES);
  const [tripleLeft, setTripleLeft] = useState(0);
  const [runId, setRunId] = useState(0);
  const scoreRef = useRef(0);
  const entry = GAME_REGISTRY[game.id];
  const name = typedName ?? user?.name ?? 'INVITADO';
  useEffect(() => {
    if (entry || over || paused) return;
    const t = setInterval(() => {
      const prev = scoreRef.current;
      const next = prev + Math.floor(10 + Math.random() * 90);
      scoreRef.current = next;
      setScore(next);
      if (Math.floor(next / LEVEL_STEP) > Math.floor(prev / LEVEL_STEP)) {
        setLevel((l) => l + 1);
      }
    }, 220);
    return () => clearInterval(t);
  }, [entry, over, paused]);
  const restart = () => {
    scoreRef.current = 0;
    setScore(0);
    setLevel(1);
    setLives(LIVES);
    setTripleLeft(0);
    setRunId((id) => id + 1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
  };
  const handleStats = (stats: GameStats) => {
    setScore(stats.score);
    setLives(stats.lives);
    setLevel(stats.level);
    setTripleLeft(stats.tripleLeft);
  };
  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };
  const save = () => {
    setSaveError(null);
    startSaving(async () => {
      try {
        const res = await saveScore(game.id, name, score);
        if (res.status === 'success') setSaved(true);
        else if (res.status === 'error') setSaveError(res.message);
      } catch {
        setSaveError('No pudimos guardar tu puntuación. Inténtalo de nuevo.');
      }
    });
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: 'var(--ink)' }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString('es-ES')}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{'♥ '.repeat(entry ? lives : LIVES).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, '0')}</div>
          </div>
          {entry && tripleLeft > 0 && (
            <div className="hud-stat">
              <div className="l">Triple</div>
              <div className="v">{tripleLeft}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <button className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {entry ? (
            <entry.Component
              paused={paused || over}
              runId={runId}
              onStats={handleStats}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>{entry ? entry.controls : 'CARGA · 1MB'}</span>
        </div>
      </div>
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString('es-ES')}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  aria-label="Tus iniciales"
                />
                <button
                  className="btn yellow"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? 'GUARDANDO…' : 'GUARDAR PUNTUACIÓN'}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && (
              <div
                role="alert"
                className="mono"
                style={{
                  color: 'var(--magenta)',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  marginTop: 10,
                }}
              >
                ▸ {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
