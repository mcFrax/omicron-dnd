import { dragState } from './state';

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

// The list of info records about scrolling elements that are ancestors of toEl,
// ordered from the closest (deepest) to the furthest (usually document.body).
// The record contains the HTMLElement and some additional data about
// the scrolling.
interface ScrollerRecord {
    el: HTMLElement,
    rect: {top: number, left: number, right: number, bottom: number},
    horizontal: boolean,
    vertical: boolean,
    snap: boolean,
    snapCooldown: boolean,
}
let scrollers: ScrollerRecord[] = [];

// List of scrollers that are currently activated, i.e. the pointer is in the
// activation are of the scrollers, close to one of the scrolling edges.
// The list contains a separate kind of entries that refers to scrollers
// entries, but contains additional data. Each entry regards to scrolling
// in only a single direction, so a scrollers can possibly have multiple
// (at least 2, but there may be degenerate cases with 3 or 4) entries,
// e.g. for scrolling up and to the left.
interface ActiveScroller {
    scrollerIndex: number,
    scrollerEl: HTMLElement,
    horizontal: number,
    vertical: number,
    speedInput: number,
}
let activeScrollers: ActiveScroller[] = [];

// Last timestamp (as passed to requestAnimationFrame callback) when
// active scrollers animation/scroll positions were updated.
// This is the base for calculating the scroll distance for the current frame.
// Always null if activeScrollers array is empty.
let lastScrollAnimationTimestamp: DOMHighResTimeStamp|null = null;

function collectScrollers(elem: HTMLElement|null) : ScrollerRecord[] {
    let result = [];
    // TODO: Include document.scrollingElement
    for (; elem; elem = elem.parentElement) {
        let style = getComputedStyle(elem);
        let horizontalScroll =
            style.overflowX === 'auto' || style.overflowX === 'scroll';
        let verticalScroll =
            style.overflowY === 'auto' || style.overflowY === 'scroll';
        if (!horizontalScroll && !verticalScroll) {
            continue;
        }
        let domRect = elem.getClientRects()[0];
        // Create our own structure. Origina DOMRect is read-only, and
        // we want to be able to make updates.
        let rect = {
            left: domRect.left,
            top: domRect.top,
            right: domRect.right,
            bottom: domRect.bottom,
        };
        result.push({
            el: elem,
            rect,
            horizontal: horizontalScroll,
            vertical: verticalScroll,
            snap: Boolean(elem.dataset.omicronScrollSnap),
            snapCooldown: false,
        });
    }
    return result;
}

// This is a helper for updateActiveScrollers, only to be called from there.
function activateScroller(scroller: ScrollerRecord, horizontal: number, vertical: number, speedInput: number) {
    if (scroller.snap) {
        if (!scroller.snapCooldown) {
            if (horizontal) {
                scroller.el.scrollLeft += horizontal * scroller.el.clientWidth;
            }
            if (vertical) {
                scroller.el.scrollTop += vertical * scroller.el.clientHeight;
            }
            scroller.snapCooldown = true; // Prevent immediate re-activation.
        }
        // TODO: Either force recomputing the rects for other scrollers after
        // the scroll, or maybe just give up caching the rects.
    } else {
        activeScrollers.push({
            scrollerIndex: scrollers.indexOf(scroller),
            scrollerEl: scroller.el,
            horizontal,
            vertical,
            speedInput,
        });
    }
}

const minScrollSpeed = 0.3; // In pixels per millisecond.
const maxScrollSpeed = 0.7; // In pixels per millisecond.
const maxScrollSpeedIncrease = maxScrollSpeed - minScrollSpeed;

function animationFrame(timestamp: DOMHighResTimeStamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    if (activeScrollers.length === 0) {
      return;
    }
    if (lastScrollAnimationTimestamp) {
        let frameTime = timestamp - lastScrollAnimationTimestamp;
        // Animate. If lastScrollAnimationTimestamp is not set, the animation
        // will start on the next frame.
        for (let s of activeScrollers) {
            // Notice the difference between entries in activeScrollers and
            // scrollers arrays, they are different.
            const scrollSpeed = minScrollSpeed + s.speedInput * maxScrollSpeedIncrease;
            if (s.vertical) {
                const oldValue = s.scrollerEl.scrollTop;
                const diff = s.vertical * scrollSpeed * frameTime;
                s.scrollerEl.scrollTop += diff;
                const actualDiff = s.scrollerEl.scrollTop - oldValue;
                if (actualDiff !== 0) {
                    updateScrollerRects(s.scrollerIndex, actualDiff, 0);
                }
            }
            if (s.horizontal) {
                const oldValue = s.scrollerEl.scrollLeft;
                const diff = s.horizontal * scrollSpeed * frameTime;
                s.scrollerEl.scrollLeft += diff;
                const actualDiff = s.scrollerEl.scrollLeft - oldValue;
                if (actualDiff !== 0) {
                    updateScrollerRects(s.scrollerIndex, 0, actualDiff);
                }
            }
        }
    }
    lastScrollAnimationTimestamp = timestamp;
    animFrameRequestId = requestAnimationFrame(animationFrame);
}

function updateScrollerRects(updateBefore: number, vDiff: number, hDiff: number) {
    for (let i = 0; i < updateBefore; ++i) {
        const rect = scrollers[i].rect;
        rect.top -= vDiff;
        rect.bottom -= vDiff;
        rect.left -= hDiff;
        rect.right -= hDiff;
    }
}


// Call this when active container changes.
export function updateScrollers(elem: HTMLElement|null) {
  scrollers = collectScrollers(elem);
}

const scrollActivationMargin = 60; // In pixels. TODO: Allow adjusting with element markup.

// Call this when mouse moves.
export function updateActiveScrollers() {
    // TODO: Remove array allocation?
    activeScrollers = [];
    if (!dragState) {
        lastScrollAnimationTimestamp = null;
        return;
    }
    const xLast = dragState.currentPointerPos.x;
    const yLast = dragState.currentPointerPos.y;
    for (let scroller of scrollers) {
        if (scroller.horizontal) {
            if (xLast < scroller.rect.left + scrollActivationMargin) {
                // Scrolling left.
                activateScroller(scroller, -1, 0,
                    (scroller.rect.left + scrollActivationMargin - xLast) / scrollActivationMargin);
            } else if (xLast > scroller.rect.right - scrollActivationMargin) {
                // Scrolling right.
                activateScroller(scroller, 1, 0,
                    (xLast - scroller.rect.right + scrollActivationMargin) / scrollActivationMargin);
            } else {
                scroller.snapCooldown = false;
            }
        }
        if (scroller.vertical) {
            if (yLast < scroller.rect.top + scrollActivationMargin) {
                // Scrolling up.
                activateScroller(scroller, 0, -1,
                    (scroller.rect.top + scrollActivationMargin - yLast) / scrollActivationMargin);
            } else if (yLast > scroller.rect.bottom - scrollActivationMargin) {
                // Scrolling down.
                activateScroller(scroller, 0, 1,
                    (yLast - scroller.rect.bottom + scrollActivationMargin) / scrollActivationMargin);
            }
        }
    }
    if (activeScrollers.length === 0) {
        // Not animating (any more). Let the next animation know that it needs
        // to count itself in, in case we didn't request previous frames.
        lastScrollAnimationTimestamp = null;
    } else {
        // Request animation for the active scrollers.
        if (!animFrameRequestId) {
            animFrameRequestId = requestAnimationFrame(animationFrame);
        }
    }
}
