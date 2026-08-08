import { ChatWorkspace } from "@/components/ChatWorkspace";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Chat</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Responde a clientes por los canales conectados en Kommo (WhatsApp, Instagram, etc.).
        </p>
      </div>
      <ChatWorkspace />
    </div>
  );
}
