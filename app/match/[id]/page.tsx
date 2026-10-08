import { Suspense } from "react";
import MatchView from "./MatchView";

type Params = Promise<{ id: string }>;

async function MatchFromParams({ params }: { params: Params }) {
  const { id } = await params;
  return <MatchView id={id} />;
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={<main className="p-4 text-sm text-muted">Loading...</main>}
    >
      <MatchFromParams params={params} />
    </Suspense>
  );
}
