import { DragKind } from './base-types';
import { dragState } from './state';

// Insertion index is the index at which we will insert the item.
// Eventual index is the index at which the inserted item will end up.
// It works like this:
//   containerEl.insertBefore(insertedItem, containerEl.children[insertionIndex])
//   const eventualIndex = Array.from(containerEl.children).indexOf(insertedItem))
//
// This means that eventualIndex is usually the same as insertionIndex,
// but there is a discrepancy when we are:
//   a) moving the item (as opposed to copying it),
//   b) inside a single container (as opposed to moving/copying to another container),
//   c) and the insertionIndex is greater than the index before move
//           (i.e. moving element further/down inside the container),
// in which case eventualIndex is insertionIndex - 1.

export function insertionIndexFromEventualIndex(containerEl: HTMLElement, eventualIndex: number) {
    if (dragState && containerEl === dragState.from.containerEl && dragState.dragKind === DragKind.Move && eventualIndex > dragState.from.index) {
        return eventualIndex + 1;
    }
    // Note: in case where nothing changes (we "move" item into the place it
    // already is at) there are 2 possible values for insertionIndex - both
    // dragState.from.index and dragState.from.index + 1 have that result.
    // We return dragState.from.index in that case, but that is arbitrary.
    return eventualIndex;
}

export function eventualIndexFromInsertionIndex(containerEl: HTMLElement, insertionIndex: number) {
    if (dragState && containerEl === dragState.from.containerEl && dragState.dragKind === DragKind.Move && insertionIndex > dragState.from.index) {
        return insertionIndex - 1;
    }
    return insertionIndex;
}
