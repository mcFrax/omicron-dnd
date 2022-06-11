import { setTransform } from "./anims";
import { ContainerEl } from "./expando";
import { getHeightWithPadding } from "./offsets";
import { BadStateError, dragState, StateEnum } from "./state";

const placeholders = new Map<HTMLElement, HTMLElement>();

export function getOrCreatePlaceholder(toEl: ContainerEl) {
    let placeholder = placeholders.get(toEl);
    if (!placeholder) {
        placeholder = createPlaceholder(toEl);
        placeholders.set(toEl, placeholder);
    }
    return placeholder;
}

export function showPlaceholder(
    placeholderEl: HTMLElement,
    animatePlaceholderFromPickedItem?: boolean,
) {
    // TODO: Use container's animation time.
    const scaleStart =
        (animatePlaceholderFromPickedItem && dragState) ?
            getHeightWithPadding(dragState.pickedEl) / getHeightWithPadding(placeholderEl) || 0 : 0;
    setTransform(placeholderEl, 'scaleY', scaleStart, 'base');
    setTransform(placeholderEl, 'opacity', 0, 'base');
}

export function hidePlaceholder(placeholderEl: HTMLElement) {
    // TODO: Use container's animation time.
    setTransform(placeholderEl, 'scaleY', 'current', 0);
    setTransform(placeholderEl, 'opacity', 'current', 0);
}

export function clearPlaceholders() {
    for (const placeholder of placeholders.values()) {
        placeholder.remove();
    }
    placeholders.clear();
}

function createPlaceholder(toEl: ContainerEl) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    const placeholderEl = document.createElement('div');
    placeholderEl.style.position = 'absolute';
    placeholderEl.style.top = '0';
    placeholderEl.style.zIndex = '1';
    placeholderEl.style.userSelect = 'none';
    placeholderEl.style.pointerEvents = 'none';
    placeholderEl.style.transformOrigin = 'top center';
    placeholderEl.classList.add('drag-placeholder');
    toEl.appendChild(placeholderEl);
    // Use set transform after appendChild, so that it captures the base opacity
    // correctly.
    setTransform(placeholderEl, 'opacity', 0);
    // Set background only if not set externally.
    if (getComputedStyle(placeholderEl).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        placeholderEl.style.background = 'lightgray';
    }
    // Set the height only if not set externally.
    let autoHeight = getComputedStyle(placeholderEl).height;
    if (!autoHeight || autoHeight === '0px') {
        placeholderEl.style.height = Math.min(dragState.initialPickupRect.height - 16, 200) + 'px';
    }
    // TODO: Figure out how to determine these properly. I guess we need to take
    // the container's clientWidth and make the actual math with margins and
    // stuff.
    // For now let's assume that the offsets on activeEl are ok and that
    // they are the same on both sides.
    placeholderEl.style.left = dragState.pickedEl.offsetLeft + 'px';
    placeholderEl.style.right = dragState.pickedEl.offsetLeft + 'px';
    return placeholderEl;
}
