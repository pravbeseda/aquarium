type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as WebkitDocument;

export function fullscreenSupported(): boolean {
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** True when launched from the home screen, which is how iPhones get a fullscreen web app. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  if (isFullscreen()) {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else doc.webkitExitFullscreen?.();
    return;
  }
  const el = element as WebkitElement;
  if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
  else el.webkitRequestFullscreen?.();
}

export function onFullscreenChange(callback: () => void): void {
  document.addEventListener('fullscreenchange', callback);
  document.addEventListener('webkitfullscreenchange', callback);
}
