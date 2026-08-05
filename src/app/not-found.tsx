import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-semibold text-petrol">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-asphalt">Pagina nao encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">O endereco acessado nao existe no MotoGestor.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
        >
          Ir para inicio
        </Link>
      </section>
    </main>
  );
}
