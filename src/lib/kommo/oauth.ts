import { prisma } from "@/lib/db";
import { assertKommoConfig, kommoBaseUrl, kommoConfig } from "./config";

/**
 * URL oficial de autorización Kommo (NO usar el subdominio de la cuenta).
 * @see https://www.kommo.com/developers/content/oauth/button
 */
export function getAuthorizeUrl(state?: string) {
  assertKommoConfig();
  const params = new URLSearchParams({
    client_id: kommoConfig.clientId,
    state: state || "crm-kommo",
    mode: "popup",
  });
  return `https://www.kommo.com/oauth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, refererSubdomain?: string) {
  assertKommoConfig();
  const subdomain = refererSubdomain || kommoConfig.subdomain;
  const tokenUrl = `https://${subdomain}.kommo.com/oauth2/access_token`;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: kommoConfig.clientId,
      client_secret: kommoConfig.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: kommoConfig.redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error OAuth token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.kommoAccount.upsert({
    where: { subdomain },
    create: {
      subdomain,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    },
  });

  return data;
}


export async function refreshAccessToken(refreshToken: string) {
  assertKommoConfig();
  const res = await fetch(`${kommoBaseUrl()}/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: kommoConfig.clientId,
      client_secret: kommoConfig.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: kommoConfig.redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error refresh token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    expires_in: number;
    access_token: string;
    refresh_token: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.kommoAccount.update({
    where: { subdomain: kommoConfig.subdomain },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    },
  });

  return data;
}

export async function getValidAccessToken(): Promise<string> {
  assertKommoConfig();
  const account = await prisma.kommoAccount.findUnique({
    where: { subdomain: kommoConfig.subdomain },
  });

  if (!account) {
    throw new Error("Cuenta Kommo no autorizada. Completa el flujo OAuth primero.");
  }

  // Renovar 60s antes de expirar
  if (account.expiresAt.getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(account.refreshToken);
    return refreshed.access_token;
  }

  return account.accessToken;
}

export async function getKommoConnectionStatus() {
  if (!kommoConfig.subdomain || !kommoConfig.clientId) {
    return { configured: false, connected: false, subdomain: null as string | null };
  }

  const account = await prisma.kommoAccount.findUnique({
    where: { subdomain: kommoConfig.subdomain },
  });

  return {
    configured: Boolean(kommoConfig.clientId && kommoConfig.clientSecret && kommoConfig.subdomain),
    connected: Boolean(account),
    subdomain: kommoConfig.subdomain,
    expiresAt: account?.expiresAt?.toISOString() ?? null,
  };
}
