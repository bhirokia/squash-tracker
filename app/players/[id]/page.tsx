import { Suspense } from "react";
import PlayerView from "./PlayerView";

type Params = Promise<{ id: string }>;

async function PlayerFromParams({ params }: { params: Params }) {
  const { id } = await params;
  return <PlayerView id={id} />;
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<main className="p-4 text-sm text-muted">Loading...</main>}>
      <PlayerFromParams params={params} />
    </Suspense>
  );
}
