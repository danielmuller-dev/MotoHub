import Link from "next/link";
import { Suspense } from "react";
import { Bike } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { FlashMessage } from "@/components/ui/flash-message";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <Suspense fallback={null}>
        <FlashMessage />
      </Suspense>
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-asphalt text-signal">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-asphalt">{APP_NAME}</span>
            <span className="block text-xs text-slate-500">Acesso seguro</span>
          </span>
        </Link>
        <h1 className="text-2xl font-semibold text-asphalt">Entrar</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use as credenciais cadastradas no seed para acessar como superadmin, gestor ou cliente.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <Link href="/forgot-password" className="mt-5 block text-sm font-medium text-petrol hover:underline">
          Esqueci minha senha
        </Link>
      </section>
    </main>
  );
}
