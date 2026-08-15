import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE = "crm_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "agent";
  kommoId: number;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET || process.env.KOMMO_CLIENT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function revealKey() {
  const secret = process.env.AUTH_SECRET || process.env.KOMMO_CLIENT_SECRET || "dev-secret-change-me";
  return scryptSync(secret, "crm-password-reveal", 32);
}

/** Copia recuperable para que el admin pueda ver la clave del asesor. */
export function encryptPassword(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", revealKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPassword(payload: string | null | undefined) {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", revealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    kommoId: user.kommoId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: (payload.email as string) || null,
      role: payload.role === "admin" ? "admin" : "agent",
      kommoId: Number(payload.kommoId),
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function loginWithEmailPassword(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email.trim() },
      isActive: true,
      passwordHash: { not: null },
    },
  });

  if (!user?.passwordHash) {
    throw new Error("Credenciales inválidas");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Credenciales inválidas");

  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "agent",
    kommoId: user.kommoId ?? 0,
  };
  await createSession(session);
  return session;
}

/** Filtro de leads: admin ve todos; agente solo los suyos. */
export function leadScopeWhere(session: SessionUser) {
  if (session.role === "admin") return {};
  return { responsibleId: session.id };
}

/** Contactos: propios o ligados a leads asignados al agente */
export function contactScopeWhere(session: SessionUser) {
  if (session.role === "admin") return {};
  return {
    OR: [
      { responsibleId: session.id },
      {
        leads: {
          some: {
            lead: {
              responsibleId: session.id,
              deletedAt: null,
            },
          },
        },
      },
    ],
  };
}
