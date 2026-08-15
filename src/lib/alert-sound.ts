const SOUND_KEY = "crm_alert_sound";

export function isAlertSoundOn() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setAlertSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

/** Beep corto (Web Audio). Requiere un clic previo en la página. */
export function playAlertSound() {
  if (typeof window === "undefined") return;
  if (!isAlertSoundOn()) return;
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
      gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };

    beep(880, 0, 0.12);
    beep(1175, 0.14, 0.18);
    setTimeout(() => void ctx.close(), 700);
  } catch {
    // autoplay bloqueado
  }
}

export function unlockAlertAudio() {
  if (typeof window === "undefined") return;
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

export type CrmAlertDetail = {
  title: string;
  body?: string;
  href?: string;
  sound?: boolean;
};

export function emitCrmAlert(detail: CrmAlertDetail) {
  if (typeof window === "undefined") return;
  if (detail.sound !== false) playAlertSound();
  window.dispatchEvent(new CustomEvent<CrmAlertDetail>("crm:alert", { detail }));
}
