import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGame, getGames } from "@/lib/games";

export async function generateStaticParams() {
  return (await getGames()).map((g) => ({ id: g.id }));
}

export default function PlayPage(props: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={null}>
      <Player params={props.params} />
    </Suspense>
  );
}

async function Player({ params }: Pick<PageProps<"/juegos/[id]/jugar">, "params">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
