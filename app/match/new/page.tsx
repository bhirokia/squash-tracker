"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Chip, SectionLabel, primaryClass } from "@/components/ui";

type Player = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-muted focus:border-accent/60";

export default function NewMatch() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(5);
  const [known, setKnown] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("players")
      .select("id,name")
      .order("name")
      .then(({ data }) => setKnown(data ?? []));
  }, []);

  async function start() {
    const a = p1.trim();
    const b = p2.trim();
    if (!a || !b) return setError("Enter both player names.");
    if (a.toLowerCase() === b.toLowerCase())
      return setError("Players must be different.");

    setSaving(true);
    setError(null);

    const { data: players, error: pErr } = await supabase
      .from("players")
      .upsert([{ name: a }, { name: b }], { onConflict: "name" })
      .select("id,name");
    if (pErr || !players) {
      setSaving(false);
      return setError(pErr?.message ?? "Couldn't save players.");
    }
    const id1 = players.find((p) => p.name === a)!.id;
    const id2 = players.find((p) => p.name === b)!.id;

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ player1_id: id1, player2_id: id2, best_of: bestOf })
      .select("id")
      .single();
    if (mErr || !match) {
      setSaving(false);
      return setError(mErr?.message ?? "Couldn't create match.");
    }

    router.push(`/match/${match.id}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-muted">
        ← Back
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-semibold tracking-tight">
        New match
      </h1>

      <datalist id="players">
        {known.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <div className="space-y-5">
        <div>
          <SectionLabel>Player 1</SectionLabel>
          <input
            list="players"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            placeholder="Name"
            className={inputClass}
          />
        </div>
        <div>
          <SectionLabel>Player 2</SectionLabel>
          <input
            list="players"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            placeholder="Name"
            className={inputClass}
          />
        </div>
        <div>
          <SectionLabel>Format</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {([1, 3, 5] as const).map((n) => (
              <Chip key={n} active={bestOf === n} onClick={() => setBestOf(n)}>
                {n === 1 ? "1 game" : `Best of ${n}`}
              </Chip>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button onClick={start} disabled={saving} className={primaryClass}>
          {saving ? "Starting..." : "Start match"}
        </button>
      </div>
    </main>
  );
}
