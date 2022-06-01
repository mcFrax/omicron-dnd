import { expando, ContainerEl } from './expando';

export default class ForbiddenIndices {

  public isForbiddenIndex(containerEl: ContainerEl, pickedEl: HTMLElement, insertionIndex: number) {
      return this.getForbiddenInsertionIndices(containerEl, pickedEl).has(insertionIndex);
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
