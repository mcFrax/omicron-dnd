
import { ContainerOptions } from "./options";
import { dragState } from "./state";

// Get elem's depth in the DOM tree.
// Note: no special handling for elements not attached to actual document.
export function getDomDepth(elem: HTMLElement|null) {
    let result = 0;
    for (elem = elem && elem.parentElement; elem; elem = elem.parentElement) {
        ++result;
    }
    return result;
}

// Get the first index for items that we consider for drag and drop
// end positioning. Skip anything with display: none.
export function getItemsInContainerStartIndex(containerEl: HTMLElement) {
    for (let i = 0; i < containerEl.children.length; ++i) {
        if (getComputedStyle(containerEl.children[i]).display !== 'none') {
            return i;
        }
    }
    // Nothing was found. That means that getItemsInContainerEnd() will also
    // find nothing and return 0, so let's return 0 for start/end consistency.
    return 0;
}

// Get the after-last index for items that we consider for drag and drop
// end positioning.
// Skip the temporary Omicron's elements at the end of the container,
// as well as anything with display: none.
export function getItemsInContainerEndIndex(containerEl: HTMLElement) {
    const floatEl = dragState?.floatEl;
    const placeholderEl = dragState?.to?.placeholderEl;
    for (let i = containerEl.children.length - 1; i >= 0; --i) {
        const candidate = containerEl.children[i];
        if (candidate !== floatEl &&
                candidate !== placeholderEl &&
                getComputedStyle(candidate).display !== 'none') {
            // i is the index of last actual element, so the end index is i+1.
            return i + 1;
        }
    }
    return 0;
}

export function getItemFromContainerEvent(event: Event, options: ContainerOptions): HTMLElement|null {
    let containerEl = event.currentTarget as HTMLElement;
    let result = null;
    let handleFound = false;
    for (let el = event.target as HTMLElement; el !== containerEl; el = el.parentElement!) {
        if (options.filterSelector && el.matches(options.filterSelector)) {
            return null;
        }
        if (options.handleSelector && el.matches(options.handleSelector)) {
            handleFound = true;
        }
        result = el;
    }
    // Returns null if the event is directly on the container,
    // or the element was filtered out for any reason.
    if (result &&
            result !== dragState?.to?.placeholderEl &&
            (!options.draggableSelector || result.matches(options.draggableSelector)) &&
            (handleFound || !options.handleSelector))
        return result;
    else {
        return null;
    }
}
