import { Anim, animMs } from "./anims";
import { getItemsInContainerEndIndex } from "./dom-traversal";
import { DragKind } from "./external-types";
import { dragState, StateEnum } from "./state";


export function animateMoveInsideContainer(containerEl: HTMLElement, previousIndex: number, newNewIndex: number) {
    // There are 4 groups of elements, adjusted by different offsets:
    //
    // 1. no offset
    // All elements before oldIndex (in fromEl) or newIndex
    // (in containerEl).
    // When fromEl === containerEl, both conditions are required.
    //
    // 2. activeToPlaceholderOffset
    // Elements in fromEl with index after max(newIndex, oldIndex).
    //
    // 3. activeToNothingOffset
    // Elements in fromEl that are after oldIndex, except those
    // after newIndex when fromEl === containerEl.
    //
    // 4. nothingToPlaceholderOffset
    // All elements after newIndex except those in fromEl that are also
    // after oldIndex.
    //
    // I though that I'd do something smart to change the elements
    // that are affected in groups, but no I'm thinking I'll go over
    // all potentially effected elements and run the above logic for
    // each of them.

    if (dragState?.state !== StateEnum.PendingDrag) return;

    const activeElHeight = dragState.pickedEl.offsetHeight;
    const activeToPlaceholderOffset =
        dragState.to ? dragState.to.placeholderEl.offsetHeight - activeElHeight : 0;
    const activeToNothingOffset = -activeElHeight - 8;
    const nothingToPlaceholderOffset = dragState.to?.placeholderEl.offsetHeight ?? 0;

    let maxItemIndex = getItemsInContainerEndIndex(containerEl) - 1;
    let affectedStart =
        Math.min(maxItemIndex, Math.min(newNewIndex, previousIndex));
    let affectedEnd =
        Math.min(maxItemIndex, Math.max(newNewIndex, previousIndex));

    if (maxItemIndex === -1) {
    return; // Empty container, nothing to animate.
    }

    // Note: we are using actual oldIndex below, not previousIndex.
    // This is because we have to deal with activeEl affecting offsets,
    // even though it's not visible.
    // Previous index doesn't matter any more here, it was only
    // for determining the affected range.
    for (let i = affectedStart; i <= affectedEnd; ++i) {
        let otherEl = containerEl.children[i] as HTMLElement;
        if (dragState.dragKind === DragKind.Move && otherEl === dragState.pickedEl) continue;

        let afterOld = (
            dragState.dragKind === DragKind.Move &&
            containerEl === dragState.from.containerEl &&
            i >= dragState.from.index);
        let afterNew = afterOld ? i > newNewIndex : i >= newNewIndex;

        if (afterNew && afterOld) {
            Anim.start(containerEl, [otherEl], activeToPlaceholderOffset, animMs);
        } else if (afterNew) {
            Anim.start(containerEl, [otherEl], nothingToPlaceholderOffset, animMs);
        } else if (afterOld) {
            Anim.start(containerEl, [otherEl], activeToNothingOffset, animMs);
        } else {
            Anim.start(containerEl, [otherEl], 0, animMs);
        }
    }
}