import { AssignmentPanel } from "@/components/AssignmentPanel";

export default function RepartoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Reparto
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Distribución automática de leads entre asesores de ConexiónCRM (ideal con 1 licencia
          Kommo).
        </p>
      </div>
      <AssignmentPanel />
    </div>
  );
}
