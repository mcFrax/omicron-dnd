import { ContainerEl } from './expando';

export type BaseDragEndEvent = {
    item: HTMLElement,
    from: HTMLElement,
    fromIndex: number,
    /**
    * @deprecated Use fromIndex instead.
    */
    oldIndex: number,
};

export type FailedDragEndEvent = BaseDragEndEvent & {
    dragExecuted: false,
};

export type SuccessfulDragEndEvent = BaseDragEndEvent & {
    dragExecuted: true,
    to: HTMLElement,
    eventualIndex: number,
    insertionIndex: number,
    /**
    * @deprecated Use eventualIndex instead.
    */
    newIndex: number,
};

export type DragEndEvent = FailedDragEndEvent | SuccessfulDragEndEvent;

export enum DragKind {
    Move,
    Copy,
}

export type Vec2D = {
    x: number;
    y: number;
};

export type EvPlace = {
    readonly clientX: number;
    readonly clientY: number;
    readonly screenX: number;
    readonly screenY: number;
};  // It really is MouseEvent|Touch, but maybe such explicity about what should be accessed is better?


export type ItemPlace = {
  containerEl: ContainerEl
  index: number
};

export type InsertionPlace = {
  containerEl: ContainerEl
  insertionIndex: number // Where we will insert item
  eventualIndex: number // Where it will end up
}

// InsertionPlace + some metadata that are present only if we have one.
export type InsertionPlaceCandidate = InsertionPlace & {
  placeholderEl: HTMLElement
  yStartNoMoveZone: number
  yEndNoMoveZone: number
}
