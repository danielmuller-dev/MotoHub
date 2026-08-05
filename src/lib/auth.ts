import "server-only";

import { compare, hash } from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { CompanyStatus, UserRole, UserStatus } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const SESSION_DAYS = 7;

export type SessionPayload = {
  userId: string;
  role: UserRole;
  companyId: string | null;
  customerId: string | null;
  exp: number;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  customerId: string | null;
  company: {
    id: string;
    legalName: string;
    tradeName: string | null;
    slug: string;
    status: CompanyStatus;
  } | null;
};

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET ??
    "motogestor-development-secret-change-before-production";

  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET precisa estar configurado em producao.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signSession(payload: Omit<SessionPayload, "exp">) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(body)) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function setSessionCookie(user: {
  id: string;
  role: UserRole;
  companyId: string | null;
  customerId: string | null;
}) {
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    signSession({
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
      customerId: user.customerId
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60
    }
  );
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const payload = verifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      companyId: true,
      customerId: true,
      company: {
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          slug: true,
          status: true
        }
      }
    }
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  if (user.company && user.company.status !== "ACTIVE" && user.role !== "SUPER_ADMIN") {
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/access-denied");
  }
  return user;
}

export async function requireCompanyRole(roles: UserRole[] = ["COMPANY_ADMIN", "EMPLOYEE"]) {
  const user = await requireRole(roles);
  if (!user.companyId) {
    redirect("/access-denied");
  }
  return user;
}

export function defaultPathForRole(role: UserRole) {
  if (role === "SUPER_ADMIN") {
    return "/superadmin";
  }
  if (role === "CUSTOMER") {
    return "/customer";
  }
  return "/dashboard";
}
