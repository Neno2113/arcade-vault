import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/games";
import { getLeaderboards } from "@/lib/scores";

export default async function SalonPage() {
  const [games, leaderboards] = await Promise.all([
    getGames(),
    getLeaderboards(12),
  ]);
  return <HallOfFame games={games} leaderboards={leaderboards} />;
}
