import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bike,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Users,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_NAME } from "@/lib/config";

const benefits = [
  {
    title: "Operacao centralizada",
    description:
      "Clientes, motos, contratos, parcelas, pagamentos, documentos e manutencoes ficam no mesmo fluxo, reduzindo retrabalho e perda de informacao.",
    icon: Gauge
  },
  {
    title: "Gestao multiempresa",
    description:
      "Cada locadora trabalha com seus proprios dados, usuarios e indicadores, enquanto o superadmin acompanha a plataforma como um SaaS.",
    icon: Building2
  },
  {
    title: "Controle financeiro claro",
    description:
      "Parcelas, pagamentos parciais, recibos e atrasos ajudam a entender o caixa da locadora com mais previsibilidade.",
    icon: CreditCard
  },
  {
    title: "Mais confianca para crescer",
    description:
      "Permissoes por perfil, historico de auditoria e area do cliente deixam a rotina mais profissional desde o primeiro atendimento.",
    icon: ShieldCheck
  }
];

const modules: Array<{ title: string; description: string; icon: LucideIcon }> = [
  {
    title: "Clientes",
    description: "Cadastro completo, documentos, CNH, contato de emergencia e historico por locadora.",
    icon: Users
  },
  {
    title: "Motos",
    description: "Placa, renavam, chassi, quilometragem, status, manutencoes e documentos do veiculo.",
    icon: Bike
  },
  {
    title: "Contratos",
    description: "Aluguel comum ou compra programada, vencimentos semanais, quinzenais ou mensais.",
    icon: ClipboardList
  },
  {
    title: "Pagamentos",
    description: "Registro de recebimentos, saldos, recibos imprimiveis e acompanhamento de atrasos.",
    icon: CreditCard
  },
  {
    title: "Manutencoes",
    description: "Revisoes preventivas, corretivas, troca de oleo, pneus, freios e proximos servicos.",
    icon: Wrench
  },
  {
    title: "Avisos",
    description: "Comunicados para clientes sobre pagamentos, contratos, documentos e informacoes gerais.",
    icon: Bell
  },
  {
    title: "Documentos",
    description: "Controle de validade de CNH, CRLV, contrato assinado e arquivos importantes.",
    icon: FileText
  },
  {
    title: "Relatorios",
    description: "Indicadores de receita, inadimplencia, frota, contratos e operacao da locadora.",
    icon: BarChart3
  }
];

const trustItems = [
  "Dados separados por empresa para evitar mistura entre locadoras.",
  "Perfis de acesso para superadmin, administrador da empresa, funcionario e cliente.",
  "Senha protegida com hash e sessao por cookie HTTP-only.",
  "Auditoria para registrar acoes importantes dentro da plataforma.",
  "Base preparada para recursos futuros como Pix, WhatsApp, assinatura digital e upload em nuvem."
];

const steps = [
  ["1", "Cadastre a empresa", "Crie a locadora, defina usuarios e organize os dados iniciais."],
  ["2", "Monte a frota", "Registre motos, documentos, status, manutencoes e informacoes de controle."],
  ["3", "Crie contratos", "Gere parcelas automaticamente e acompanhe vencimentos por periodo."],
  ["4", "Acompanhe resultados", "Veja pagamentos, atrasos, clientes, frota e historico operacional."]
];

export default function SaibaMaisPage() {
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
              href="/"
              className="hidden h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50 sm:inline-flex"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
              <ShieldCheck className="h-4 w-4 text-petrol" aria-hidden="true" />
              Plataforma SaaS para locadoras de motos
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-asphalt sm:text-5xl">
              Transforme sua locadora em uma operacao organizada, previsivel e pronta
              para crescer.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              O {APP_NAME} foi desenhado para tirar a gestao da planilha solta e colocar
              contratos, frota, clientes, pagamentos e documentos dentro de um processo
              profissional. A locadora ganha controle, o cliente ganha clareza e a
              empresa passa a operar com mais seguranca.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-asphalt px-5 text-sm font-semibold text-white hover:bg-graphite"
              >
                Entrar no painel
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="#vantagens"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold hover:bg-slate-50"
              >
                Ver vantagens
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-soft">
            <div className="rounded-md bg-asphalt p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-300">Visao executiva</p>
                  <p className="mt-1 text-2xl font-semibold">Controle real da locadora</p>
                </div>
                <Bike className="h-9 w-9 text-signal" aria-hidden="true" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Contratos", "ativos, vencidos e quitados"],
                  ["Frota", "disponivel, alugada e em manutencao"],
                  ["Caixa", "recebimentos, atrasos e recibos"]
                ].map(([title, description]) => (
                  <div key={title} className="rounded-md bg-white/10 p-4">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="font-semibold">Antes do MotoGestor</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-600">
                  <p>Planilhas espalhadas e informacoes duplicadas.</p>
                  <p>Vencimentos conferidos manualmente.</p>
                  <p>Historico de cliente e moto dificil de localizar.</p>
                  <p>Gestao financeira sem visao consolidada.</p>
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="font-semibold">Com o MotoGestor</p>
                <div className="mt-4 grid gap-3 text-sm">
                  {[
                    "Rotina padronizada para todos os usuarios.",
                    "Parcelas geradas automaticamente por contrato.",
                    "Painel com indicadores da empresa e da frota.",
                    "Area do cliente para consultar pagamentos, avisos e documentos."
                  ].map((item) => (
                    <span key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="vantagens" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-petrol">
            Vantagens
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Por que uma locadora escolhe o {APP_NAME}</h2>
          <p className="mt-4 leading-7 text-slate-600">
            A plataforma foi pensada para a rotina real de aluguel de motos: contrato
            recorrente, pagamento frequente, manutencao constante, documentos com prazo
            e necessidade de acompanhar tudo sem perder velocidade no atendimento.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <benefit.icon className="h-6 w-6 text-petrol" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-petrol">
                Modulos
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Tudo que a locadora precisa para operar com menos improviso.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                O {APP_NAME} conecta as partes que normalmente ficam separadas:
                atendimento, contrato, financeiro, manutencao, documentos, relatorios
                e comunicacao com cliente.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((module) => {
                const Icon = module.icon;

                return (
                  <article key={module.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <Icon className="h-5 w-5 text-petrol" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold">{module.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-petrol">
              Confianca
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Estrutura pensada para vender como SaaS e operar como sistema serio.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Uma locadora precisa de velocidade, mas tambem precisa de registro,
              separacao de acesso e previsibilidade. O {APP_NAME} organiza a base para
              crescer com novas empresas, usuarios e recursos sem perder controle.
            </p>
            <div className="mt-7 grid gap-3">
              {trustItems.map((item) => (
                <span key={item} className="flex gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-petrol" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="font-semibold">Como a implantacao acontece</p>
            <div className="mt-5 grid gap-4">
              {steps.map(([number, title, description]) => (
                <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-asphalt text-sm font-semibold text-white">
                    {number}
                  </span>
                  <div className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-asphalt text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-medium text-slate-300">Pronto para operar melhor?</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold">
              Use o {APP_NAME} para transformar controle operacional em crescimento.
            </h2>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md bg-signal px-5 text-sm font-semibold text-asphalt hover:bg-yellow-400"
          >
            Entrar no painel
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
