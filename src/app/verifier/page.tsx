"use client";

import { Fraunces } from "next/font/google";
import Link from "next/link";
import { useEffect, useState } from "react";

const display = Fraunces({ subsets: ["latin"], weight: ["500"] });

type Verdict = {
  ok: boolean;
  reason?: string;
  number?: string;
  clientName?: string;
  totalLabel?: string;
  issuedOnLabel?: string;
  kind?: string;
};

export default function VerifierPage() {
  const [code, setCode] = useState("");
  const [verdict, setVerdict] = useState<(Verdict & { lines?: string[] }) | null>(null);

  async function check(sceau: string) {
    const response = await fetch(`/api/verifier?sceau=${encodeURIComponent(sceau)}`);
    setVerdict((await response.json()) as Verdict);
  }

  useEffect(() => {
    const sceau = new URLSearchParams(window.location.search).get("sceau");
    if (sceau) {
      setCode(sceau);
      void check(sceau);
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-[#efe7da] px-6 py-12 text-[#1a2744]">
      <p className="text-xs tracking-[0.16em] text-[#7a6a52] uppercase">Maison Adjovi & Fils</p>
      <h1 className={`${display.className} text-4xl`}>Vérifier une facture</h1>
      <p className="mt-2 text-sm text-[#5c5346]">Scannez le QR, ou collez le code imprimé sous la feuille. Un montant modifié casse le sceau.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void check(code);
        }}
      >
        <label className="block text-sm" htmlFor="code">
          Code ou lien
          <textarea id="code" className="mt-1 min-h-24 w-full rounded-xl border border-[#d9cbb6] bg-white p-3 text-sm" value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <button type="submit" className="rounded-lg bg-[#1a2744] px-4 py-2 text-sm text-white">
          Vérifier
        </button>
      </form>
      {verdict && (
        <article className="mt-6 rounded-sm bg-[#fffaf3] p-5 shadow-md" role="status">
          {verdict.ok ? (
            <>
              <p className="text-sm text-[#0e6b4f]">Sceau authentique</p>
              <h2 className={`${display.className} text-3xl`}>{verdict.number}</h2>
              <p className="mt-2">{verdict.kind} · {verdict.clientName}</p>
              <p className="text-xl">{verdict.totalLabel}</p>
              <p className="text-sm text-[#5c5346]">Émise le {verdict.issuedOnLabel}</p>
              {verdict.lines && verdict.lines.length > 0 && <p className="mt-2 text-sm">{verdict.lines.join(" · ")}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-red-800">Sceau refusé</p>
              <p className="mt-2">{verdict.reason}</p>
            </>
          )}
        </article>
      )}
      <Link className="mt-8 text-sm underline-offset-4 hover:underline" href="/">
        Retour à l'atelier
      </Link>
    </main>
  );
}
