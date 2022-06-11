
export type KnownLengthProperty =
  'marginBottom' | 'marginTop' | 'marginLeft' | 'marginRight' |
  'paddingBottom' | 'paddingTop' | 'paddingLeft' | 'paddingRight' |
  'borderBottomWidth' | 'borderTopWidth' | 'borderLeftWidth' | 'borderRightWidth' |
  'height' | 'width' | 'maxHeight' | 'maxWidth' |
  'rowGap' | 'columnGap';

export type KnownBareNumberProperty = 'opacity';

export type KnownNumberProperty = KnownLengthProperty | KnownBareNumberProperty;

export function getComputedStyleOr0(elem: Element | undefined | null, prop: KnownNumberProperty): number {
  if (!elem) return 0;
  return parseFloat(getComputedStyle(elem)[prop]);
}
