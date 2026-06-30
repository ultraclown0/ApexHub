// Простой ограничитель частоты запросов: гарантирует минимальный
// интервал между вызовами (бережём лимиты сторонних API).
export class RateLimiter {
  private last = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait() {
    const elapsed = Date.now() - this.last;
    const remaining = this.minIntervalMs - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    this.last = Date.now();
  }
}
