const SOUND_KEY = "crm_alert_sound";
const READ_KEY = "crm_chat_read_v1";
const UNREAD_KEY = "crm_chat_unread_v1";

export function isAlertSoundOn() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setAlertSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

/** WAV corto embebido (beep) — más fiable que WebAudio en algunos navegadores */
const BEEP_WAV =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgATp3i4Y1qBQBUouXij2kFAFSk5eKPagUAUaTl4o9qBQBRpeXij2kFAFGl5eKPagUAUaXl4o9qBQ==";

let sharedAudio: HTMLAudioElement | null = null;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(BEEP_WAV);
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

export function unlockAlertAudio() {
  if (typeof window === "undefined") return;
  try {
    const a = getAudio();
    if (!a) return;
    a.muted = true;
    void a.play().then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    });
  } catch {
    // ignore
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().then(() => ctx.close());
  } catch {
    // ignore
  }
}

export function playAlertSound() {
  if (typeof window === "undefined") return;
  if (!isAlertSoundOn()) return;

  // 1) HTML Audio
  try {
    const a = getAudio();
    if (a) {
      a.currentTime = 0;
      a.muted = false;
      void a.play().catch(() => playWebAudioFallback());
      // segundo beep
      setTimeout(() => {
        try {
          const a2 = getAudio();
          if (a2) {
            a2.currentTime = 0;
            void a2.play();
          }
        } catch {
          // ignore
        }
      }, 160);
      return;
    }
  } catch {
    // fall through
  }
  playWebAudioFallback();
}

function playWebAudioFallback() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    beep(880, 0, 0.14);
    beep(1240, 0.16, 0.18);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // ignore
  }
}

export type CrmAlertDetail = {
  title: string;
  body?: string;
  href?: string;
  leadId?: string;
  talkId?: number;
  sound?: boolean;
};

export function emitCrmAlert(detail: CrmAlertDetail) {
  if (typeof window === "undefined") return;
  if (detail.sound !== false) playAlertSound();
  if (detail.talkId != null) bumpUnread(detail.talkId, 1);
  window.dispatchEvent(new CustomEvent<CrmAlertDetail>("crm:alert", { detail }));
}

export function getReadMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function markTalkRead(talkId: number, updatedAt?: number) {
  const map = getReadMap();
  map[String(talkId)] = updatedAt || Math.floor(Date.now() / 1000);
  localStorage.setItem(READ_KEY, JSON.stringify(map));
  const unread = getUnreadMap();
  delete unread[String(talkId)];
  localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
}

export function getUnreadMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(UNREAD_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function bumpUnread(talkId: number, by = 1) {
  const unread = getUnreadMap();
  const key = String(talkId);
  unread[key] = (unread[key] || 0) + by;
  localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
  return unread[key];
}

export function setUnread(talkId: number, count: number) {
  const unread = getUnreadMap();
  const key = String(talkId);
  if (count <= 0) delete unread[key];
  else unread[key] = count;
  localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
}

/** Si el talk se actualizó después de la última lectura y no hay contador, marca 1+ */
export function syncUnreadFromTalk(talkId: number, updatedAt?: number) {
  if (!updatedAt) return getUnreadMap()[String(talkId)] || 0;
  const read = getReadMap()[String(talkId)] || 0;
  const unread = getUnreadMap();
  const key = String(talkId);
  if (updatedAt > read) {
    if (!unread[key]) unread[key] = 1;
    localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
    return unread[key];
  }
  return unread[key] || 0;
}
