"use client";

import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        E-mail
        <input
          name="email"
          type="email"
          required
          placeholder="gestor@motogestor.demo"
          className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-petrol focus:ring-2 focus:ring-petrol/15"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Senha
        <span className="flex h-11 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-petrol focus-within:ring-2 focus-within:ring-petrol/15">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Senha temporaria"
            className="min-w-0 flex-1 px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="flex w-11 items-center justify-center text-slate-500 hover:bg-slate-50"
            aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </span>
      </label>
      <Button type="submit" className="h-11">
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Entrar
      </Button>
    </form>
  );
}
