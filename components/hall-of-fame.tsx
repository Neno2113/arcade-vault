"use client";

import { useState } from "react";
import Link from "next/link";
import type { Game, ScoreRow } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("es-ES");

export function HallOfFame({
  games,
  leaderboards,
}: {
  games: Game[];
  leaderboards: Record<string, ScoreRow[]>;
}) {
  const [tab, setTab] = useState(games[0].id);
  const rows = leaderboards[tab] ?? [];
  const [first, second, third] = rows;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 16px",
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NO HAY PUNTUACIONES
          </div>
          <div>Sé el primero en dejar tu nombre en este juego.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {second && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{second.name}</div>
                <div className="score">{fmt(second.score)}</div>
                <div className="date">{second.date}</div>
              </div>
            )}
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{first.name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {fmt(first.score)}
              </div>
              <div className="date">{first.date}</div>
            </div>
            {third && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{third.name}</div>
                <div className="score">{fmt(third.score)}</div>
                <div className="date">{third.date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.rank}
                className={
                  "tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{fmt(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
