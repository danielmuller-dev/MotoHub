import Link from "next/link";
import { Lock } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <Lock className="mx-auto h-9 w-9 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-asphalt">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sua conta nao tem permissao para visualizar esta area.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
        >
          Voltar
        </Link>
      </section>
    </main>
  );
}
