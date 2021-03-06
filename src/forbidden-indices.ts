import { expando, ContainerEl } from './expando';

export class ForbiddenIndices {

  public isForbiddenIndex(containerEl: ContainerEl, pickedEl: HTMLElement, insertionIndex: number) {
      return this.getForbiddenInsertionIndices(containerEl, pickedEl).has(insertionIndex);
  }

  public furthestAllowedInsertionIndex(
    containerEl: ContainerEl,
    pickedEl: HTMLElement,
    currentInsertionIndex: number,
    pointedInsertionIndex: number,
  ) {
      const forbiddenSet = this.getForbiddenInsertionIndices(containerEl, pickedEl);
      const stepBack = pointedInsertionIndex < currentInsertionIndex ? 1 : -1;
      for (let idx = pointedInsertionIndex; idx !== currentInsertionIndex; idx += stepBack) {
        if (!forbiddenSet.has(idx)) return idx;
      }
      return currentInsertionIndex;
  }

  private getForbiddenInsertionIndices(containerEl: ContainerEl, pickedEl: HTMLElement) {
      let cachedValue = this.forbiddenInsertionIndicesCache.get(containerEl);
      if (cachedValue) {
          return cachedValue;
      }
      const fn = containerEl[expando].options.forbiddenInsertionIndicesFn;
      let newValue: Set<number>;
      if (typeof fn === 'function') {
          newValue = new Set(fn(containerEl, pickedEl));
      } else {
          newValue = new Set();
      }
      this.forbiddenInsertionIndicesCache.set(containerEl, newValue);
      return newValue;
  }

  private forbiddenInsertionIndicesCache: Map<HTMLElement, Set<number>> = new Map();
}
