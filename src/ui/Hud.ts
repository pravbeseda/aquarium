import { fullscreenSupported, isFullscreen, isStandalone, onFullscreenChange, toggleFullscreen } from './fullscreen';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

/** Switches the start screen to an error message; works before the HUD or the renderer exist. */
export function showFatalError(message: string): void {
  byId('overlay').classList.remove('hidden');
  const status = byId('status');
  status.textContent = message;
  status.classList.add('error');
  byId('start').hidden = true;
}

/** The DOM layer: start screen, loading progress, hints and the fullscreen button. */
export class Hud {
  private readonly overlay = byId<HTMLDivElement>('overlay');
  private readonly progress = byId<HTMLDivElement>('progress-bar');
  private readonly status = byId<HTMLParagraphElement>('status');
  private readonly startButton = byId<HTMLButtonElement>('start');
  private readonly hint = byId<HTMLDivElement>('hint');
  private readonly toast = byId<HTMLDivElement>('toast');
  private readonly fullscreenButton = byId<HTMLButtonElement>('fullscreen');
  private hintTimer = 0;
  private shownProgress = 0;
  private toastTimer = 0;

  constructor(root: HTMLElement, touch: boolean) {
    document.body.classList.toggle('touch', touch);
    const canFullscreen = fullscreenSupported();
    this.fullscreenButton.hidden = !canFullscreen && isStandalone();
    this.fullscreenButton.addEventListener('click', () => {
      if (canFullscreen) {
        toggleFullscreen(root).catch(() => this.showToast('Fullscreen was blocked by the browser.'));
      } else {
        this.showToast('For fullscreen on iPhone: tap Share, then “Add to Home Screen”.');
      }
    });
    onFullscreenChange(() => this.fullscreenButton.classList.toggle('on', isFullscreen()));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && canFullscreen && !e.repeat) void toggleFullscreen(root).catch(() => undefined);
    });
  }

  /** Progress only moves forward; late loader events cannot rewind the bar or its label. */
  setProgress(fraction: number, text?: string): void {
    if (fraction < this.shownProgress) return;
    this.shownProgress = fraction;
    this.progress.style.width = `${Math.round(fraction * 100)}%`;
    if (text !== undefined) this.status.textContent = text;
  }

  ready(onStart: () => void): void {
    this.setProgress(1, '');
    this.startButton.disabled = false;
    this.startButton.textContent = 'Dive in';
    this.startButton.addEventListener('click', onStart);
  }

  /** Shows or hides the start/pause screen; `paused` changes its wording. */
  showOverlay(visible: boolean, paused = false): void {
    this.overlay.classList.toggle('hidden', !visible);
    this.overlay.classList.toggle('paused', paused);
    if (paused) this.startButton.textContent = 'Continue';
  }

  flashHint(): void {
    this.hint.classList.add('visible');
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hint.classList.remove('visible'), 7000);
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 4500);
  }
}
