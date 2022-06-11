import { setTransform } from "./anims";
import { getItemsInContainerEndIndex } from "./dom-traversal";
import { ContainerEl, expando } from "./expando";
import { DragKind } from "./external-types";
import { getOffsets } from "./offsets";
import { dragState } from "./state";


export function animateMoveInsideContainer(containerEl: ContainerEl, previousEventualIndex: number, newEventualIndex: number) {
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

    if (!dragState) return;

    const {
        pickedToPlaceholderOffset,
        gapToPlaceholderOffset,
    } = getOffsets(dragState);

    const maxItemIndex = getItemsInContainerEndIndex(containerEl) - 1;
    const affectedStart =
        Math.min(maxItemIndex, Math.min(newEventualIndex, previousEventualIndex));
    const affectedEnd =
        Math.min(maxItemIndex, Math.max(newEventualIndex, previousEventualIndex));

    if (maxItemIndex === -1) {
        return; // Empty container, nothing to animate.
    }

    const animTimeMs = containerEl[expando].options.animationTimeMs;

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
        let afterNew = afterOld ? i > newEventualIndex : i >= newEventualIndex;

        let newTranslation: number;
        if (afterNew && afterOld) {
            newTranslation = pickedToPlaceholderOffset;
        } else if (afterNew) {
            newTranslation = gapToPlaceholderOffset;
        } else if (afterOld) {
            newTranslation = dragState.pickedElToGapOffset;
        } else {
            newTranslation = 0;
        }
        setTransform(otherEl, 'translateY', 'current', newTranslation, animTimeMs);
    }
}
