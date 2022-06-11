import { InsertionPlaceCandidate } from "./base-types";
import { findNextStaticSibling, findPreviousStaticSibling, getItemsInContainerEndIndex, getItemsInContainerStartIndex } from "./dom-traversal";
import { DragKind } from "./external-types";
import { BadStateError, DragState, dragState, StateEnum } from "./state";
import { getComputedStyleOr0, KnownLengthProperty } from "./style-basics";

const borderHeightIngredients: KnownLengthProperty[] =
    ['height', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'];

export function getBorderSizeHeight(elem: Element): number {
  if (getComputedStyle(elem).boxSizing === 'border-box') {
    return getComputedStyleOr0(elem, 'height');
  }
  return borderHeightIngredients.reduce((acc, prop) => acc + getComputedStyleOr0(elem, prop), 0);
}

export function getEffectiveMarginBetweenSiblings(
  item1: Element | undefined,
  item2: Element | undefined,
): number {
  const parent = (item1 ?? item2)?.parentElement;
  if (!parent) return 0;
  const margin1 = getComputedStyleOr0(item1, 'marginBottom');
  const margin2 = getComputedStyleOr0(item2, 'marginTop');
  const parentStyle = getComputedStyle(parent);
  if (parentStyle.display === 'flex' || parentStyle.display === 'inline-flex') {
    // row-gap may be 'normal', which would parse to NaN - we need to manually
    // collapse it to 0.
    return margin1 + margin2 + (parseFloat(parentStyle.rowGap) || 0);
  }
  // TODO: Handle negative margins?
  // Here is the doc for margin collapsing:
  // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Box_Model/Mastering_margin_collapsing
  return Math.max(margin1, margin2);
}

export function getEffectiveTopSiblingMargin(item: Element): number {
  return getEffectiveMarginBetweenSiblings(findPreviousStaticSibling(item), item);
}

export function getEffectiveBottomSiblingMargin(item: Element): number {
  return getEffectiveMarginBetweenSiblings(item, findNextStaticSibling(item));
}

export function getItemToNothingOffset(item: HTMLElement): number {
    return -(
        getBorderSizeHeight(item) +
        getEffectiveTopSiblingMargin(item) +
        getEffectiveBottomSiblingMargin(item));
}

export function getGapBetweenSiblingsAfterItemRemoval(item: HTMLElement): number {
    const topSibling = findPreviousStaticSibling(item);
    const bottomSibling = findNextStaticSibling(item);
    return getEffectiveMarginBetweenSiblings(topSibling, bottomSibling);
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

  const gap = getEffectiveMarginBetweenSiblings(topSibling, bottomSibling);

  const effectiveTopGap = getEffectiveMarginBetweenSiblings(topSibling, to.placeholderEl);
  const effectiveBottomGap = getEffectiveMarginBetweenSiblings(to.placeholderEl, bottomSibling);

  return getBorderSizeHeight(to.placeholderEl) + effectiveTopGap + effectiveBottomGap - gap;
}

export function getOffsets(dragState: DragState) {
    const pickedToGapOffset = dragState.pickedElToGapOffset;
    const gapToPlaceholderOffset =
            (dragState.state === StateEnum.PendingDrag && dragState.to?.gapToPlaceholderOffset) || 0;
    return {
        pickedToGapOffset,
        pickedToPlaceholderOffset: pickedToGapOffset + gapToPlaceholderOffset,
        gapToPlaceholderOffset,
    };
}
