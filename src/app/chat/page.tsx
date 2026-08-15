import { ChatWorkspace } from "@/components/ChatWorkspace";

export default function ChatPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 shrink-0">
        <h1 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)] sm:text-2xl">
          Chat
        </h1>
        <p className="text-xs text-[var(--muted)] sm:text-sm">
          WhatsApp y canales Kommo · escribe abajo
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatWorkspace />
      </div>
    </div>
  );
}
