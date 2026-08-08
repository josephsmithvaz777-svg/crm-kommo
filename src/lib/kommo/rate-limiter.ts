/**
 * Rate limiter simple ~6-7 req/s (límite API Kommo).
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerSecond: number;

  constructor(maxPerSecond = 6) {
    this.maxPerSecond = maxPerSecond;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 1000);

    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0];
      const delay = 1000 - (now - oldest) + 10;
      await new Promise((r) => setTimeout(r, delay));
      return this.wait();
    }

    this.timestamps.push(Date.now());
  }
}

export const kommoRateLimiter = new RateLimiter(6);
