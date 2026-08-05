import Link from "next/link";
import { Mail } from "lucide-react";
import { APP_NAME } from "@/lib/config";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <Mail className="h-8 w-8 text-petrol" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-asphalt">Recuperacao preparada</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          O {APP_NAME} ja possui a rota de recuperacao reservada para futura integracao
          com envio de e-mail. Nesta versao MVP, um administrador deve redefinir a senha
          pela equipe ou pelo seed.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
        >
          Voltar para login
        </Link>
      </section>
    </main>
  );
}
