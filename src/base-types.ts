import { ContainerEl } from './expando';

export type Vec2D = {
    x: number;
    y: number;
};

export type EvPlace = {
    readonly clientX: number;
    readonly clientY: number;
};


export type ItemOriginalPlace = {
  containerEl: ContainerEl
  // The original index of pickedEl, i.e.
  // Array.from(fromEl.children).indexOf(pickedEl).
  // We assume that this value stays correct during the drag.
  index: number
};

export type InsertionPlace = {
  containerEl: ContainerEl
  insertionIndex: number // Where we will insert item
  eventualIndex: number // Where it will end up
}

// InsertionPlace + some metadata that are present only if we have one.
export type InsertionPlaceCandidate = InsertionPlace & {
  // Current placeholder element. Placeholder is a grey rectangle filling the
  // target space of the drag. The placeholder is always created inside toEl,
  // at the end, with position: absolute.
  // The placeholder has CSS class .drag-placeholder. You can use this class
  // to define height of the placeholder for a container (or globally). If the
  // height of the placeholder is CSS-defined, this height it used, otherwise,
  // a activeEl's height-derived default is used.
  placeholderEl: HTMLElement
  // The offset by which the items below placeholder should be moved visually
  // to accomodate the placeholder.
  gapToPlaceholderOffset: number
}
