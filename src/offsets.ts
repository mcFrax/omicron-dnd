import { InsertionPlaceCandidate } from "./base-types";
import { findNextStaticSibling, findPreviousStaticSibling, getItemsInContainerEndIndex, getItemsInContainerStartIndex } from "./dom-traversal";
import { DragKind } from "./external-types";
import { BadStateError, dragState, StateEnum } from "./state";


type KnownLengthProperty =
    'marginBottom' | 'marginTop' | 'marginLeft' | 'marginRight' |
    'height' | 'width';

export function getComputedStyleOr0(elem: Element | undefined | null, prop: KnownLengthProperty): number {
  if (!elem) return 0;
  return parseFloat(getComputedStyle(elem)[prop]);
}

export function getTopSiblingMargin(item: Element) {
  return getComputedStyleOr0(findPreviousStaticSibling(item), 'marginBottom');
}

export function getBottomSiblingMargin(item: Element) {
  return getComputedStyleOr0(findNextStaticSibling(item), 'marginTop');
}

export function getEffectiveTopSiblingMargin(item: Element) {
  const ownMargin = parseFloat(getComputedStyle(item).marginTop);
  return Math.max(getTopSiblingMargin(item), ownMargin);
}

export function getEffectiveBottomSiblingMargin(item: Element) {
  const ownMargin = parseFloat(getComputedStyle(item).marginBottom);
  return Math.max(getBottomSiblingMargin(item), ownMargin);
}

export function getItemToNothingOffset(item: HTMLElement): number {
    return -(
        getComputedStyleOr0(item, 'height') +
        getEffectiveTopSiblingMargin(item) +
        getEffectiveBottomSiblingMargin(item));
}

export function getGapBetweenSiblingsAfterItemRemoval(item: HTMLElement): number {
    const topSibling = findPreviousStaticSibling(item);
    const bottomSibling = findNextStaticSibling(item);

    if (!topSibling || !bottomSibling) return 0;

    const topSiblingMargin = getComputedStyleOr0(topSibling, 'marginBottom');
    const bottomSiblingMargin = getComputedStyleOr0(topSibling, 'marginTop');

    return Math.max(topSiblingMargin, bottomSiblingMargin);
}

export function getGapToPlaceholderOffset(to: InsertionPlaceCandidate): number {
  if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
  let topSibling: Element | undefined
  let bottomSibling: Element | undefined
  if (dragState.dragKind === DragKind.Move &&
          to.containerEl === dragState.from.containerEl &&
          to.eventualIndex === dragState.from.index) {
      // Dropping exactly at the starting place.
      topSibling = findPreviousStaticSibling(dragState.pickedEl);
      bottomSibling = findNextStaticSibling(dragState.pickedEl);
  } else {
      const rangeStart = getItemsInContainerStartIndex(to.containerEl);
      const rangeEnd = getItemsInContainerEndIndex(to.containerEl);
      if (to.insertionIndex < rangeEnd) {
        // Inserting before an existing element.
        bottomSibling = to.containerEl.children[to.insertionIndex];
        topSibling = findPreviousStaticSibling(bottomSibling);
      } else {
        // Inserting at the end.
        bottomSibling = undefined;
        // TODO: This is a bit shaky, as we don't really check the position: static here,
        // unlike in the other case.
        // Perhaps that is something that getItemsInContainerEndIndex could
        // take into account (it might even replace checks for special elements).
        topSibling = (rangeEnd > rangeStart) ? to.containerEl.children[rangeEnd - 1] : undefined;
      }
  }
  const topSiblingMargin = getComputedStyleOr0(topSibling, 'marginBottom');
  const bottomSiblingMargin = getComputedStyleOr0(bottomSibling, 'marginTop');

  const gap = (!topSibling || !bottomSibling) ? 0 : Math.max(topSiblingMargin, bottomSiblingMargin);

  const effectiveTopGap =
      !topSibling ? 0 : Math.max(getComputedStyleOr0(to.placeholderEl, 'marginBottom'), topSiblingMargin);
  const effectiveBottomGap =
      !bottomSibling ? 0 : Math.max(getComputedStyleOr0(to.placeholderEl, 'marginTop'), bottomSiblingMargin);

  return getComputedStyleOr0(to.placeholderEl, 'height') + effectiveTopGap + effectiveBottomGap - gap;
}

export function getOffsets() {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    const pickedToGapOffset = dragState.pickedElToGapOffset;
    const gapToPlaceholderOffset = dragState.to?.gapToPlaceholderOffset || 0;
    return {
        pickedToGapOffset,
        pickedToPlaceholderOffset: pickedToGapOffset + gapToPlaceholderOffset,
        gapToPlaceholderOffset,
    };
}
