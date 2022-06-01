import { dragState, StateEnum } from "./state";

export function getActiveToNothingOffset(): number {
    if (!dragState) {
      return 0;
    }
    const css = getComputedStyle(dragState.pickedEl);
    const greaterMargin = Math.max(parseFloat(css.marginTop || '0'), parseFloat(css.marginBottom || '0'));
    return -parseFloat(css.height || '0') - greaterMargin;
}

export function getNothingToPlaceholderOffset(): number {
  if (dragState?.state !== StateEnum.PendingDrag || !dragState.to) {
    return 0;
  }
  const css = getComputedStyle(dragState.to.placeholderEl);
  const greaterMargin = Math.max(parseFloat(css.marginTop || '0'), parseFloat(css.marginBottom || '0'));
  return parseFloat(css.height || '0') + greaterMargin;
}

export function getActiveToPlaceholderOffset(): number {
  return getActiveToNothingOffset() + getNothingToPlaceholderOffset();
}

export function getOffsets() {
  const activeToNothingOffset = getActiveToNothingOffset();
  const nothingToPlaceholderOffset = getNothingToPlaceholderOffset();
  return {
    activeToNothingOffset,
    nothingToPlaceholderOffset,
    activeToPlaceholderOffset: activeToNothingOffset + nothingToPlaceholderOffset,
  };
}
