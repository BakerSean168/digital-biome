/**
 * True when a keydown belongs to an IME composition and must not trigger shortcuts.
 *
 * `isComposing` is the standard signal. Safari dispatches the keydown that commits a
 * composition with `isComposing === false` and the legacy `keyCode` 229, so that value
 * remains the documented cross-browser fallback (MDN, KeyboardEvent.isComposing). It is
 * read only here so the deprecated property has a single, explained call site.
 */
export function isImeComposition(event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  return event.isComposing || event.keyCode === 229;
}
