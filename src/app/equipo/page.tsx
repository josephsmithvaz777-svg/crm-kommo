import { TeamPanel } from "@/components/TeamPanel";

export default function EquipoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Equipo</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configura accesos de los 10 asesores vinculados a Kommo.
        </p>
      </div>
      <TeamPanel />
    </div>
  );
}
