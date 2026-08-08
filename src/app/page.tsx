import { SyncPanel } from "@/components/SyncPanel";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">Inmobiliario</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)] sm:text-5xl">
          ConexiónCRM
        </h1>
        <p className="mt-3 text-base text-[var(--muted)]">
          Migración y sincronización en tiempo real con tu cuenta de Kommo: leads, contactos,
          embudos, tareas y notas, con <code className="text-[var(--ink)]">kommo_id</code> para
          evitar duplicados.
        </p>
      </section>
      <SyncPanel />
    </div>
  );
}
