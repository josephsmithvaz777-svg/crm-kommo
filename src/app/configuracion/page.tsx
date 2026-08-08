import { SyncPanel } from "@/components/SyncPanel";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Integración Kommo
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          1) Crea una integración privada en Kommo · 2) Copia Client ID / Secret y subdominio a{" "}
          <code>.env</code> · 3) Autoriza OAuth · 4) Ejecuta migración completa · 5) Registra
          webhooks para sync en tiempo real.
        </p>
      </div>

      {params.connected && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Cuenta Kommo autorizada correctamente.
        </div>
      )}
      {params.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Error OAuth: {params.error}
        </div>
      )}

      <SyncPanel />

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Variables .env
        </h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--sand)]/60 p-4 text-xs text-[var(--ink)]">
{`KOMMO_CLIENT_ID=...
KOMMO_CLIENT_SECRET=...
KOMMO_SUBDOMAIN=tu-cuenta
KOMMO_REDIRECT_URI=http://localhost:3000/api/kommo/oauth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
KOMMO_WEBHOOK_SECRET=opcional`}
        </pre>
        <p className="mt-4">
          Limitaciones: historial de WhatsApp/chats, archivos multimedia, Salesbot y contraseñas de
          usuarios no se migran automáticamente; hay que reconectar canales y recrear accesos.
        </p>
      </section>
    </div>
  );
}
