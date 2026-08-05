import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bike,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { APP_NAME } from "@/lib/config";

const features = [
  {
    title: "Contratos de aluguel e compra",
    description: "Crie contratos comuns ou com intencao de compra e gere parcelas automaticamente.",
    icon: ClipboardList
  },
  {
    title: "Controle de motos",
    description: "Acompanhe disponibilidade, manutencao, documentos e historico por veiculo.",
    icon: Bike
  },
  {
    title: "Pagamentos e recibos",
    description: "Registre pagamentos integrais ou parciais, acompanhe saldos e imprima recibos.",
    icon: CreditCard
  },
  {
    title: "Alertas internos",
    description: "Avise clientes sobre pagamentos, documentos, contratos e comunicados.",
    icon: Bell
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-asphalt">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-asphalt text-signal">
              <Bike className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              Entrar
            </Link>
            <Link
              href="/login?demo=1"
              className="hidden h-10 items-center justify-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite sm:inline-flex"
            >
              Ver demo
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
              <ShieldCheck className="h-4 w-4 text-petrol" aria-hidden="true" />
              SaaS multiempresa para locadoras
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-asphalt sm:text-5xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Organize motos, clientes, contratos, parcelas, pagamentos, manutencoes,
              documentos e area do cliente em uma plataforma preparada para crescer com
              a locadora.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-asphalt px-5 text-sm font-semibold text-white hover:bg-graphite"
              >
                Acessar painel
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/forgot-password"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold hover:bg-slate-50"
              >
                Recuperar acesso
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-soft">
            <div className="rounded-md bg-asphalt p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Locadora Piloto</p>
                  <p className="text-xl font-semibold">Painel operacional</p>
                </div>
                <Bike className="h-9 w-9 text-signal" aria-hidden="true" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Motos", "32"],
                  ["Alugadas", "24"],
                  ["Atrasadas", "7"],
                  ["Semana", "R$ 9,8k"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.8fr]">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Recebimentos</p>
                  <BarChart3 className="h-5 w-5 text-petrol" aria-hidden="true" />
                </div>
                <div className="flex h-40 items-end gap-2">
                  {[48, 72, 55, 86, 65, 92, 78].map((height, index) => (
                    <span
                      key={index}
                      className="w-full rounded-t bg-petrol"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="font-semibold">Alertas</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-mint" aria-hidden="true" />
                    3 contratos vencem hoje
                  </span>
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-signal" aria-hidden="true" />
                    2 revisoes agendadas
                  </span>
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-petrol" aria-hidden="true" />
                    6 avisos nao lidos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <feature.icon className="h-6 w-6 text-petrol" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{APP_NAME} - MVP funcional para locadoras de motos.</p>
          <p>Planos e cobranca SaaS: em breve.</p>
        </div>
      </footer>
    </main>
  );
}
