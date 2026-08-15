import { ChatWorkspace } from "@/components/ChatWorkspace";

export default function ChatPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">Chat</h1>
        <p className="text-sm text-[var(--muted)]">
          Responde por WhatsApp y otros canales de Kommo. Abajo verás el cuadro para escribir.
        </p>
      </div>
      <ChatWorkspace />
    </div>
  );
}
