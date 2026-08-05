import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { FlashMessage } from "@/components/ui/flash-message";
import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <Suspense fallback={null}>
        <FlashMessage />
      </Suspense>
      {children}
    </AppShell>
  );
}
