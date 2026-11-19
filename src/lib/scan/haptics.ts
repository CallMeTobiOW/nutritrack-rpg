/**
 * A short haptic tap for a successful scan.
 *
 * Android browsers support `navigator.vibrate`. Safari on iPhone does not,
 * but from iOS 18 toggling a native switch control plays the system haptic,
 * so we click a hidden one. Anywhere neither works, this does nothing.
 */
export function hapticTap(): void {
  if (typeof document === 'undefined') return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.vibrate(25)) return;
  } catch {
    /* fall through to the iOS switch */
  }
  try {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* no haptics available */
  }
}
