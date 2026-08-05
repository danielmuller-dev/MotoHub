"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <h1 className="text-2xl font-semibold text-asphalt">Algo saiu do eixo</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nao exibimos detalhes internos aqui, mas voce pode tentar carregar a pagina novamente.
        </p>
        <Button onClick={reset} className="mt-6">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </section>
    </main>
  );
}
