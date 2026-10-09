// Pausable countdown driven by requestAnimationFrame.

export class Countdown {
  /**
   * @param {object} opts
   * @param {number} opts.seconds
   * @param {(remaining: number, elapsed: number) => void} [opts.onTick]  seconds, every frame
   * @param {() => void} [opts.onDone]
   */
  constructor({ seconds, onTick = () => {}, onDone = () => {} }) {
    this.total = seconds * 1000;
    this.elapsed = 0;
    this.onTick = onTick;
    this.onDone = onDone;
    this.frame = null;
    this.last = 0;
    this.running = false;
  }

  get remaining() {
    return Math.max(0, this.total - this.elapsed) / 1000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.elapsed += now - this.last;
      this.last = now;
      this.onTick(this.remaining, this.elapsed / 1000);
      if (!this.running) return; // onTick may stop us
      if (this.elapsed >= this.total) {
        this.running = false;
        this.onDone();
        return;
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  resume() {
    this.start();
  }

  stop() {
    this.pause();
  }
}
