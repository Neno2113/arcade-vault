import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlays } from "@/lib/catalog";
import { getGame, getGames } from "@/lib/games";
import { getTopScores } from "@/lib/scores";

export async function generateStaticParams() {
  return (await getGames()).map((g) => ({ id: g.id }));
}

export default function GameDetailPage(props: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={null}>
      <GameDetail params={props.params} />
    </Suspense>
  );
}

async function GameDetail({ params }: Pick<PageProps<"/juegos/[id]">, "params">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getTopScores(game.id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Puntuaciones</div>
              <div className="v">{formatPlays(game.plays)}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}
              >
                {game.best === null ? "—" : game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/biblioteca" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div
              className="pixel"
              style={{
                padding: "40px 12px",
                textAlign: "center",
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              AÚN NO HAY PUNTUACIONES
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={r.rank}
              className={
                "lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
