export default class ForbiddenIndices {

  public isForbiddenIndex(containerEl: HTMLElement, pickedEl: HTMLElement, index: number) {
      return this.getForbiddenInsertionIndices(containerEl, pickedEl).has(index);
  }

  private getForbiddenInsertionIndices(containerEl: HTMLElement, pickedEl: HTMLElement) {
      let cachedValue = this.forbiddenInsertionIndicesCache.get(containerEl);
      if (cachedValue) {
          return cachedValue;
      }
      const fn =
          ((containerEl as any)[expando] as ContainerData).options.forbiddenInsertionIndicesFn;
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

