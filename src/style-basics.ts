
export type KnownLengthProperty =
  'marginBottom' | 'marginTop' | 'marginLeft' | 'marginRight' |
  'paddingBottom' | 'paddingTop' | 'paddingLeft' | 'paddingRight' |
  'height' | 'width' | 'maxHeight' | 'maxWidth' |
  'rowGap' | 'columnGap';

export function getComputedStyleOr0(elem: Element | undefined | null, prop: KnownLengthProperty): number {
  if (!elem) return 0;
  return parseFloat(getComputedStyle(elem)[prop]);
}
