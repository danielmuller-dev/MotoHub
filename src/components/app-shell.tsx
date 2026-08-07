import Link from "next/link";
import {
  Bell,
  Bike,
  Building2,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  History,
  Home,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  Wrench
} from "lucide-react";
import { APP_NAME } from "@/lib/config";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import { roleLabels } from "@/lib/format";
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

function navForUser(user: CurrentUser): NavItem[] {
  if (user.role === "SUPER_ADMIN") {
    return [
      { label: "Geral", href: "/superadmin", icon: Shield },
      { label: "Empresas", href: "/superadmin/companies", icon: Building2 }
    ];
  }

  if (user.role === "CUSTOMER") {
    return [
      { label: "Inicio", href: "/customer", icon: Home },
      { label: "Meu contrato", href: "/customer/contract", icon: ClipboardList },
      { label: "Minha moto", href: "/customer/motorcycle", icon: Bike },
      { label: "Vistorias", href: "/customer/inspections", icon: ClipboardCheck },
      { label: "Pagamentos", href: "/customer/payments", icon: CreditCard },
      { label: "Documentos", href: "/customer/documents", icon: FileText },
      { label: "Avisos", href: "/customer/notifications", icon: Bell }
    ];
  }

  return [
    { label: "Dashboard", href: "/dashboard", icon: Gauge },
    { label: "Clientes", href: "/customers", icon: Users },
    { label: "Motos", href: "/motorcycles", icon: Bike },
    { label: "Contratos", href: "/contracts", icon: ClipboardList },
    { label: "Vistorias", href: "/inspections", icon: ClipboardCheck },
    { label: "Parcelas", href: "/installments", icon: FileText },
    { label: "Pagamentos", href: "/payments", icon: CreditCard },
    { label: "Manutencoes", href: "/maintenance", icon: Wrench },
    { label: "Documentos", href: "/documents", icon: FileText },
    { label: "Avisos", href: "/notifications", icon: Bell },
    { label: "Relatorios", href: "/reports", icon: Gauge },
    { label: "Equipe", href: "/team", icon: Users },
    { label: "Auditoria", href: "/audit", icon: History },
    { label: "Configuracoes", href: "/settings", icon: Settings }
  ];
}

function Navigation({ items }: { items: NavItem[] }) {
  return (
    <nav className="grid gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-asphalt"
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const items = navForUser(user);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-asphalt text-signal">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-asphalt">{APP_NAME}</span>
            <span className="block text-xs text-slate-500">Gestao de locacao</span>
          </span>
        </Link>
        <div className="mt-8">
          <Navigation items={items} />
        </div>
        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-asphalt">{user.name}</p>
          <p className="mt-1 text-xs text-slate-500">{roleLabels[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span className="flex items-center gap-3 font-semibold text-asphalt">
              <Bike className="h-5 w-5 text-petrol" aria-hidden="true" />
              {APP_NAME}
            </span>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Navigation items={items} />
            <form action={logoutAction} className="mt-3">
              <Button type="submit" variant="secondary" size="sm">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </Button>
            </form>
          </div>
        </details>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:ml-72 lg:px-8">{children}</main>
    </div>
  );
}
