import { PipelineBoard } from "@/components/PipelineBoard";

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Embudos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Arrastra leads entre etapas o usa el selector. El cambio se sincroniza con Kommo.
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
