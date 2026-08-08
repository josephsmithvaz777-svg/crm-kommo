export const kommoConfig = {
  clientId: process.env.KOMMO_CLIENT_ID || "",
  clientSecret: process.env.KOMMO_CLIENT_SECRET || "",
  redirectUri:
    process.env.KOMMO_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/kommo/oauth/callback`,
  subdomain: process.env.KOMMO_SUBDOMAIN || "",
  webhookSecret: process.env.KOMMO_WEBHOOK_SECRET || "",
  /** Límite oficial aproximado: ~7 req/s */
  maxRequestsPerSecond: 6,
};

export function assertKommoConfig() {
  if (!kommoConfig.clientId || !kommoConfig.clientSecret) {
    throw new Error(
      "Faltan KOMMO_CLIENT_ID o KOMMO_CLIENT_SECRET en .env. Crea una integración privada en Kommo.",
    );
  }
  if (!kommoConfig.subdomain) {
    throw new Error("Falta KOMMO_SUBDOMAIN en .env (ej: miempresa).");
  }
}

export function kommoBaseUrl(subdomain?: string) {
  const sub = subdomain || kommoConfig.subdomain;
  if (!sub) throw new Error("Subdominio de Kommo no configurado");
  return `https://${sub}.kommo.com`;
}
