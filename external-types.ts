// These are types that user interacts with directly.

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
