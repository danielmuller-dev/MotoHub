import Link from "next/link";
import { connection } from "next/server";
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
import { prisma } from "@/lib/prisma";

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

async function getPlatformStats() {
  await connection();

  try {
    const [totalCompanies, activeCompanies, totalCustomers, totalMotorcycles] =
      await Promise.all([
        prisma.company.count({ where: { deletedAt: null } }),
        prisma.company.count({ where: { deletedAt: null, status: "ACTIVE" } }),
        prisma.customer.count({ where: { deletedAt: null } }),
        prisma.motorcycle.count({ where: { deletedAt: null } })
      ]);

    return {
      totalCompanies,
      activeCompanies,
      totalCustomers,
      totalMotorcycles
    };
  } catch {
    return {
      totalCompanies: 0,
      activeCompanies: 0,
      totalCustomers: 0,
      totalMotorcycles: 0
    };
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default async function LandingPage() {
  const platformStats = await getPlatformStats();
  const companyLabel =
    platformStats.totalCompanies === 1 ? "empresa cadastrada" : "empresas cadastradas";

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
              href="/saiba-mais"
              className="hidden h-10 items-center justify-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite sm:inline-flex"
            >
              Saiba mais
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
                href="/saiba-mais"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-asphalt px-5 text-sm font-semibold text-white hover:bg-graphite"
              >
                Saiba mais
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
                  <p className="text-sm text-slate-300">{APP_NAME}</p>
                  <p className="text-xl font-semibold">Painel operacional</p>
                </div>
                <Bike className="h-9 w-9 text-signal" aria-hidden="true" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Empresas", formatCount(platformStats.totalCompanies), companyLabel],
                  ["Ativas", formatCount(platformStats.activeCompanies), "em operacao"],
                  ["Clientes", formatCount(platformStats.totalCustomers), "na base"],
                  ["Motos", formatCount(platformStats.totalMotorcycles), "cadastradas"]
                ].map(([label, value, helper]) => (
                  <div key={label} className="rounded-md bg-white/10 p-3">
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{helper}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.8fr]">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">MotoGestor em operacao</p>
                  <BarChart3 className="h-5 w-5 text-petrol" aria-hidden="true" />
                </div>
                <div className="space-y-4 py-2">
                  {[
                    ["Gestao multiempresa", "Locadoras separadas com dados isolados.", 96],
                    ["Controle financeiro", "Contratos, parcelas e recibos no mesmo fluxo.", 88],
                    ["Rotina operacional", "Motos, clientes, manutencoes e documentos conectados.", 92]
                  ].map(([title, description, progress]) => (
                    <div key={title}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                        </div>
                        <span className="text-sm font-semibold text-petrol">{progress}%</span>
                      </div>
                      <span className="mt-2 block h-2 rounded-full bg-slate-100">
                        <span
                          className="block h-2 rounded-full bg-petrol"
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="font-semibold">Confianca da plataforma</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-mint" aria-hidden="true" />
                    Sistema preparado para acompanhar varias empresas
                  </span>
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-signal" aria-hidden="true" />
                    Permissoes por superadmin, gestor, equipe e cliente
                  </span>
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-petrol" aria-hidden="true" />
                    Auditoria e historico para operacoes importantes
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
