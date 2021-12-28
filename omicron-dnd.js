const animMs = 100;

let pointerId = null;
let htmlOvescrollBehavior; // Cached value to be reverted after drag.
let bodyOvescrollBehavior; // Cached value to be reverted after drag.
let touchDrag = false;
let fromEl = null;
let toEl = null;
let activeEl = null;
let floatEl = null;
let placeholderEl = null;
// TODO: current semantic is actually spliceIndex+insertIndex. It would
// be likely better to change it to actually oldIndex and newIndex.
// Or at least rename them to reflect the actual semantic.
let oldIndex = 0;
let newIndex = 0;
let initialActiveElRect = null;
let activeToPlaceholderOffset = 0;
let activeToNothingOffset = 0;
let nothingToPlaceholderOffset = 0;
let xCursorOffset = 0;
let yCursorOffset = 0;
let xInitial = 0;
let yInitial = 0;
let xLast = 0;
let yLast = 0;
let xDragClientPos = 0;
let yDragClientPos = 0;
let yStartNoMoveZone = 0; // When cursor is between yStartNoMoveZone
let yEndNoMoveZone = 0;   // and yEndNoMoveZone nothing will happen.
let animFrameRequestId = 0; // 0 is never used as actual id.
let yDirection = -1;
let preDragTimeoutId = 0;
let scrollers = [];
let knownScrollers = new Map();
let activeScrollers = [];
let lastScrollAnimationTimestamp = null;

let anims = [];
let animsByElem = new Map();
// elem => [x, y]; no [0, 0] stored.
let transformsByElem = new Map();

const minimalMoveMouse = 5;
const delay = 220;

// containerEl => containerData
const hoverContainers = new Map();
// containerData from containers under mouse.
// Sorted from the deepest to most shallow (i.e. max to min).
const hoverContainersByDepth = [];

// elem => [Number]
let forbiddenInsertionIndicesCache = new Map();

const defaultOptions = {
    draggableSelector: null,
    filterSelector: null,
    handleSelector: null,
    // Guards without suffix are a rate of width, those with 'px' are in pixels.
    enterGuardLeft: 0,
    enterGuardLeftPx: 0,
    enterGuardRight: 0,
    enterGuardRightPx: 0,
    // forbiddenInsertionIndicesFn will be called once per container during
    // each drag, and the result will be cached.
    forbiddenInsertionIndicesFn: null,
    // createFloatElemFn: null,

    // onBeforePreDrag: Called just before preDrag starts.
    // Return explicit `false` to cancel the drag.
    // onBeforePreDrag(containerEl, activeEl, event)
    onBeforePreDrag: null,

    // The element was chosen and the wait starts for the delay or minimal mouse
    // move to start dragging. The return value is ignored.
    // onPreDragStart(containerEl, activeEl, event)
    onPreDragStart: null,

    // Called just after the conditions for the drag start are met, but before
    // any styling (transforms) for the drag started, before placeholder
    // and floatEl are created. The return value is ignored.
    // onBeforeDragStart(containerEl, activeEl)
    onBeforeDragStart: null,

    // The floatEl to be placed under the pointer was created. You can edit its
    // internal DOM structure.
    // Use it to remove or override any "pointer-events: all" rules you might
    // have created inside the element, as they will break the drag logic.
    // onFloatElementCreated(floatEl, containerEl, activeEl)
    onFloatElementCreated: null,

    // The element is actually being dragged now. The return value is ignored.
    // onDragStart(containerEl, activeEl)
    onDragStart: null,

    // The container became toEl. This will fire right after onDragStart
    // for the fromEl (being also toEl) and then for every entered container.
    // onContainerEntered(containerEl, activeEl)
    onContainerEntered: null,

    // The container is no longer toEl. This will fire at the end of
    // the drag, too, before the drag finish events.
    // onContainerLeft(containerEl, activeEl)
    onContainerLeft: null,

    // The same event format is shared between onInternalChange,
    // onDropToOtherContainer, onDropFromOtherContainer.

    // Called on change where toEl === fromEl.
    // onInternalChange(dragEndEvent)
    onInternalChange: null,

    // Called on fromEl when toEl !== fromEl.
    // onDropToOtherContainer(dragEndEvent)
    onDropToOtherContainer: null,

    // Called on toEl when toEl !== fromEl.
    // onDropFromOtherContainer(dragEndEvent)
    onDropFromOtherContainer: null,

    // The drag or pre-drag was finished. In case it was a sucessful drag,
    // called after relevant onInternalChange/onDrop callback, with the same
    // event.
    // onDragFinished(dragEndEvent)
    onDragFinished: null,
};

function initDragContainer(containerEl, options) {
    if (containerEl.omicronDragAndDropData) {
        return;  // Ignore repeated calls.
    }
    const containerData = {
        el: containerEl,
        options: Object.assign({}, defaultOptions, options || {}),
        domDepth: 0, // To be updated dynamically when added to hoverContainers.
    };
    containerEl.addEventListener('touchdown', anyState_container_TouchDown, {passive: false, capture: false});
    containerEl.addEventListener('pointerdown', anyState_container_PointerDown, {passive: false, capture: false});
    containerEl.addEventListener('pointerenter', anyState_container_PointerEnter, {passive: false, capture: false});
    containerEl.addEventListener('pointerleave', anyState_container_PointerLeave, {passive: false, capture: false});
    containerEl.omicronDragAndDropData = containerData;
}
function setEvents_statePreDrag() {
    if (touchDrag) {
        document.addEventListener('touchdown', statePreDrag_window_TouchDown, {passive: false, capture: false});
        document.addEventListener('touchmove', statePreDrag_window_TouchMove, {passive: false, capture: false});
        document.addEventListener('touchend', statePreDrag_window_TouchEndOrCancel, {passive: false, capture: false});
        document.addEventListener('touchcancel', statePreDrag_window_TouchEndOrCancel, {passive: false, capture: false});
        document.addEventListener('pointermove', cancelIfCancellable, {passive: false, capture: false});
    } else {
        document.addEventListener('pointermove', statePreDrag_window_PointerMove, {passive: false, capture: false});
        document.addEventListener('pointerup', statePreDrag_window_PointerUp, {passive: false, capture: false});
    }
}
function unsetEvents_statePreDrag() {
    if (touchDrag) {
        document.removeEventListener('touchdown', statePreDrag_window_TouchDown, {passive: false, capture: false});
        document.removeEventListener('touchmove', statePreDrag_window_TouchMove, {passive: false, capture: false});
        document.removeEventListener('touchend', statePreDrag_window_TouchEndOrCancel, {passive: false, capture: false});
        document.removeEventListener('touchcancel', statePreDrag_window_TouchEndOrCancel, {passive: false, capture: false});
        document.removeEventListener('pointermove', cancelIfCancellable, {passive: false, capture: false});
    } else {
        document.removeEventListener('pointermove', statePreDrag_window_PointerMove, {passive: false, capture: false});
        document.removeEventListener('pointerup', statePreDrag_window_PointerUp, {passive: false, capture: false});
    }
}
function setEvents_stateDrag() {
    if (touchDrag) {
        // For preventing multi-touch while dragging.
        document.addEventListener('touchdown', stateDrag_window_TouchDown, {passive: false, capture: false});
        // We need to capture touchmove events in order to call
        // .preventDefault() on them and stop the scrolling.
        // Calling .preventDefault() on PointerEvents doesn't do that.
        document.addEventListener('touchmove', stateDrag_window_TouchMove, {passive: false, capture: false});
        document.addEventListener('touchend', stateDrag_window_TouchEnd, {passive: false, capture: false});
        document.addEventListener('touchcancel', stateDrag_window_TouchCancel, {passive: false, capture: false});
        document.addEventListener('pointermove', cancelIfCancellable, {passive: false, capture: false});
    } else {
        document.addEventListener('pointermove', stateDrag_window_PointerMove, {passive: false, capture: false});
        document.addEventListener('pointerup', stateDrag_window_PointerUp, {passive: false, capture: false});
    }
}
function unsetEvents_stateDrag() {
    if (touchDrag) {
        document.removeEventListener('touchdown', stateDrag_window_TouchDown, {passive: false, capture: false});
        document.removeEventListener('touchmove', stateDrag_window_TouchMove, {passive: false, capture: false});
        document.removeEventListener('touchend', stateDrag_window_TouchEnd, {passive: false, capture: false});
        document.removeEventListener('touchcancel', stateDrag_window_TouchCancel, {passive: false, capture: false});
        document.removeEventListener('pointermove', cancelIfCancellable, {passive: false, capture: false});
    } else {
        document.removeEventListener('pointermove', stateDrag_window_PointerMove, {passive: false, capture: false});
        document.removeEventListener('pointerup', stateDrag_window_PointerUp, {passive: false, capture: false});
    }
}
function cancelIfCancellable(event) {
    if (event.cancelable) {
        event.preventDefault();
    }
}
function anyState_container_TouchDown(event) {
    if (activeEl !== null || pointerId !== null) {
        return;
    }
    touchDrag = true;
    // Note: nothing to do if startPreDrag fails, but it may change at some point.
    startPreDrag(event, event);
}
function anyState_container_PointerDown(event) {
    // Unconditionally release pointer capture. I do that before any checks
    // for pending drag to avoid unnecessary races with touchdown.

    // Pointermove events are by default all captured by the pointerdown's target.
    // That means no pointerenter/pointerleave events, that we rely on, so
    // we need to release the pointer capture.
    // Source: https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
    event.target.releasePointerCapture(event.pointerId);

    if (activeEl !== null || pointerId !== null) {
        return;
    }
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
        // When using mouse, allow only the main button.
        // event.button on PointerEvent unfortunately doesn't work,
        // but event.buttons does.
        return;
    }
    touchDrag = (event.pointerType === 'touch');

    if (startPreDrag(event, event)) {
        pointerId = event.pointerId;
    }
}

// TODO: Enable fallback event handlers in case PointerEvents are not available.
// function anyState_container_fallbackMouseDown(event) {
//     if (activeEl !== null) {
//         return; // Not interesting;
//     }
//     if (event.button !== 0) {
//         // Not the main button, forget that if was ever pressed.
//         return;
//     }
//     touchDrag = false;
//     startPreDrag(event, event);
// }

// function anyState_container_fallbackTouchDown(event) {
//     if (activeEl !== null) {
//         return; // Not interesting;
//     }
//     if (event.touches.length !== 1) {
//         // We only handle single finger touches.
//         return;
//     }
//     touchDrag = true;
//     startPreDrag(event, event.touches.item(0));
// }

// Returns true if preDrag actually started.
function startPreDrag(event, evPlace) {
    let containerData = event.currentTarget.omicronDragAndDropData;
    const containerOptions = containerData.options;
    activeEl = getItemFromContainerEvent(event, containerData.options);
    if (!activeEl) {
        // TODO: Add an option to .stopPropagation() here as well, to prevent
        // dragging the container by elements, event if not by the handle?
        return false;
    }
    // Allow the callback to cancel the preDrag before it starts.
    // This can be used to implement some dynamic barrier on top of
    // draggableSelector, filterSelector, and handleSelector.
    if (typeof containerOptions.onBeforePreDrag === 'function' &&
            containerOptions.onBeforePreDrag(containerData.el, activeEl, event) === false) {
        activeEl = null;
        return false;
    }

    // Only stop propagation after deciding that something was indeed grabbed.
    // That allows the nested container to be dragged by contents when using
    // handle/filter, or just being grabbed by the padding/empty area.
    event.stopPropagation();

    toEl = fromEl = containerData.el;

    containerData.domDepth = getDomDepth(fromEl);
    hoverContainers.set(fromEl, containerData); // Make sure the current container is on the list.
    if (hoverContainersByDepth.indexOf(containerData) === -1) {
        hoverContainersByDepth.push(containerData);
        hoverContainersByDepth.sort(cmpDomDepth);
    }
    // Should we go over the whole activeEl subtree and mark the containers there
    // as inactive? We may need to, actually.

    setEvents_statePreDrag();

    xInitial = xLast = evPlace.clientX;
    yInitial = yLast = evPlace.clientY;
    initialActiveElRect = activeEl.getClientRects()[0];

    // We are in statePreDrag. We will start the drag after a delay, or if
    // the mouse moves sufficiently far. We will cancel the drag if the touch
    // moves too far before the delay.
    preDragTimeoutId = setTimeout(startDrag, delay);

    if (typeof containerOptions.onPreDragStart === 'function') {
        containerOptions.onPreDragStart(fromEl, activeEl, event);
    }
    return true;
}

function startDrag() {
    if (preDragTimeoutId) {
        clearTimeout(preDragTimeoutId);
        preDragTimeoutId = 0;
    }
    let containerData = fromEl.omicronDragAndDropData;
    const containerOptions = containerData.options;
    if (typeof containerOptions.onBeforeDragStart === 'function') {
        containerOptions.onBeforeDragStart(fromEl, activeEl);
    }

    setEvents_stateDrag();
    unsetEvents_statePreDrag();

    scrollers = collectScrollers(toEl);

    // Prevent the scroll-to-refresh behavior and the effect
    // of bumping into the scroll end on mobile.
    // TODO: call it only after the delay.
    htmlOvescrollBehavior = document.documentElement.style.overscrollBehavior;
    bodyOvescrollBehavior = document.body.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    // I add some arbitrary difference to give the effect of the element
    // snapping out of place, instead of just staying in place silently.
    xCursorOffset = initialActiveElRect.left - xInitial + 16;
    yCursorOffset = initialActiveElRect.top - yInitial - 4;
    xDragClientPos = xLast + xCursorOffset;
    yDragClientPos = yLast + yCursorOffset;

    createPlaceholder();

    const activeElHeight = activeEl.offsetHeight;

    // Note: placeholder height may change depending on the container, but
    // it will always stay the same for fromEl, and activeToX offsets are
    // only used in fromEl - so we can compute them just once, unlike
    // nothingToPlaceholderOffset.
    activeToPlaceholderOffset = placeholderEl.offsetHeight - activeElHeight;
    activeToNothingOffset = -activeElHeight - 8;

    placeholderEl.style.transform = `translateY(${activeEl.offsetTop}px)`;
    activatePlaceholder();

    createFloatEl();

    if (typeof containerOptions.onFloatElementCreated === 'function') {
        containerOptions.onFloatElementCreated(floatEl, fromEl, activeEl);
    }

    styleActiveEl();

    yStartNoMoveZone = activeEl.offsetTop - 8;
    // We need to compute the end from the top, and use placeholder's
    // height instead of the element's height.
    yEndNoMoveZone = activeEl.offsetTop - nothingToPlaceholderOffset;

    // Note: this is a string with px.

    let childrenArray = Array.from(fromEl.children);
    newIndex = oldIndex = childrenArray.indexOf(activeEl);
    // Use getItemsInContainerCount() to skip placeholder at the end.
    let itemsAfter = childrenArray.slice(oldIndex + 1, getItemsInContainerEnd(fromEl));
    Anim.start(fromEl, itemsAfter, activeToPlaceholderOffset, animMs);

    if (typeof containerOptions.onDragStart === 'function') {
        containerOptions.onDragStart(fromEl, activeEl);
    }
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(fromEl, activeEl);
    }
}
function statePreDrag_window_TouchDown(event) {
    if (event.touches.length !== 1) {
        // We don't allow multi-touch during drag.
        exitDrag(false);
    }
}
function statePreDrag_window_TouchMove(event) {
    // We may not be able to cancel the scroll any more after this event,
    // so we have to give up the drag.
    exitDrag(false);
}
function statePreDrag_window_TouchEndOrCancel(event) {
    exitDrag(false);
    // This is pre-drag and no move happened, so we allow the click,
    // hence no preventDefault() call here.
}
function statePreDrag_window_PointerMove(event) {
    if (event.pointerId !== pointerId) {
        return;
    }
    xLast = event.clientX;
    yLast = event.clientY;
    let xDiff = xLast - xInitial;
    let yDiff = xLast - xInitial;
    let distanceSquaredFromInitial = xDiff * xDiff + yDiff * yDiff;
    if (distanceSquaredFromInitial >  minimalMoveMouse * minimalMoveMouse) {
        startDrag();
    }
}
function statePreDrag_window_PointerUp(event) {
    if (event.pointerId !== pointerId) {
        return;
    }
    exitDrag(false);
}
function stateDrag_window_TouchDown(event) {
    // We don't allow multi-touch during dragging.
    exitDrag(false);
}
function stateDrag_window_TouchMove(event) {
    if (event.cancelable) {
        // Prevent scroll.
        event.preventDefault();
    }

    if (event.touches.length !== 1) {
        // We don't allow multi-touch during dragging.
        exitDrag(false);
        return;
    }

    handleMove(event.touches.item(0));
}
function stateDrag_window_PointerMove(event) {
    if (event.pointerId !== pointerId) {
        return;
    }

    handleMove(event);
}

// This is to be called only when the pointer actually moves.
function handleMove(evtPoint) {
    // Update the mouse position.
    if (evtPoint.clientY !== yLast) {
        yDirection = evtPoint.clientY > yLast ? 1 : -1;
    }
    xLast = evtPoint.clientX;
    yLast = evtPoint.clientY;
    xDragClientPos = xLast + xCursorOffset;
    yDragClientPos = yLast + yCursorOffset;

    // Update the position of floatEl before the next frame.
    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }

    updateOnMove(evtPoint);
}

// This is to be called both when pointer moves, and to invoke synthetic update
// after scroll.
function updateOnMove(evtPoint) {
    // If we are hovering over some containers that are descendants
    // of toEl but we didn't enter them yet for any reason, let's reconsider.
    const toElDomDepth = toEl ? toEl.omicronDragAndDropData.domDepth : -1;
    for (let i = 0; i < hoverContainersByDepth.length; ++i) {
        if (hoverContainersByDepth[i].domDepth <= toElDomDepth) {
            // Not looking at toEl or ancestors.
            break;
        }
        if (maybeEnterContainer(hoverContainersByDepth[i], evtPoint)) {
            // enterContainer took take care of handling the new position
            // and animation, so our work here is done.
            return;
        }
    }

    if (!toEl) {
        return;
    }

    updateActiveScrollers();

    let updatedNewIndex = findUpdatedNewIndex(evtPoint);

    if (updatedNewIndex != newIndex && !isForbiddenIndex(toEl, updatedNewIndex)) {
        let previousIndex = newIndex;
        newIndex = updatedNewIndex;
        animateMoveInsideContainer(toEl, previousIndex, updatedNewIndex);

        setPlaceholderAndNoMoveZone();
    }
}

const scrollActivationMargin = 60; // In pixels. TODO: Allow adjusting with element markup.

function updateActiveScrollers() {
    // TODO: Remove array allocation?
    activeScrollers = [];
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

// This is a helper for updateActiveScrollers, only to be called from there.
function activateScroller(scroller, horizontal, vertical, speedInput) {
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
            scrollerEl: scroller.el,
            horizontal,
            vertical,
            speedInput,
        });
    }
}

// By default, we optimize the search by going only from the current index
// in the direction of mouseY, and only when the move is outside of
// precomputed zone where we know no move happened. When insertionContainer
// is supplied, we ignore both optimizations.
function findUpdatedNewIndex(evtPoint, insertionContainer) {
    let ignoreCurrentNewIndex = Boolean(insertionContainer);
    let containerEl = insertionContainer || toEl;
    // TODO: There is some glitch in how mouseY works after autoscroll.
    // I don't know what the issue is, but there is some shift introduced,
    // perhaps at this place.
    let mouseY = evtPoint.clientY - containerEl.getClientRects()[0].top;

    let updatedNewIndex = newIndex;

    let wiggleZoneSize = 0.5;
    let snapMargin = (1 - wiggleZoneSize) / 2;
    let bottomSnapBorder = yDirection === -1 ? (1 - snapMargin) : snapMargin;
    let startIndex = getItemsInContainerStart(containerEl);
    let endIndex = getItemsInContainerEnd(containerEl);
    if (ignoreCurrentNewIndex || mouseY < yStartNoMoveZone && newIndex !== 0) {
        // Correct for the fact that if we dragged the element down from
        // its place, some elements above it are shifted from their
        // offset position.
        let offsetCorrection = containerEl === fromEl ? activeToNothingOffset : 0;
        updatedNewIndex = startIndex;
        // We may look up one extra element at the start, but that is not an issue.
        let iterationStart = endIndex - 1;
        if (!ignoreCurrentNewIndex && newIndex < iterationStart) {
            iterationStart = newIndex;
        }
        for (let i = iterationStart; i >= startIndex; --i) {
            let otherEl = containerEl.children[i];
            if (otherEl === activeEl) continue;
            if (i < oldIndex) {
                // We could check for (toEl === fromEl) here, but the
                // value is going to be 0 anyway.
                offsetCorrection = 0;
            }
            if (getComputedStyle(otherEl).display === 'none') {
                continue;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY > otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl after otherEl.
                if (containerEl === fromEl && i > oldIndex) {
                    // Special new case. otherEl will be moved up
                    // and end up with index i-1, so inserting after
                    // it means we will end up with index i.
                    updatedNewIndex = i;
                } else {
                    updatedNewIndex = i + 1;
                }
                break;
            }
        }
    } else if (mouseY > yEndNoMoveZone) {
        let offsetCorrection = nothingToPlaceholderOffset;
        // Set to the highest possible value - in case we are at the very
        // bottom of the container.
        updatedNewIndex = (containerEl === fromEl) ? endIndex - 1 : endIndex;
        // We may look up one extra element at the start, but that is not an issue.
        for (let i = newIndex; i < endIndex; ++i) {
            let otherEl = containerEl.children[i];
            if (otherEl === activeEl) continue;  // May still happen.
            if (i > oldIndex && containerEl === fromEl) {
                offsetCorrection = activeToPlaceholderOffset;
            }
            if (getComputedStyle(otherEl).display === 'none') {
                continue;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY < otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl before otherEl.
                if (containerEl === fromEl && i > oldIndex) {
                    // Special new case. otherEl won't be bumped to i+1
                    // but instead back to i-th position when we
                    // re-insert activeEl, so the inserting splice
                    // will be at position i-1, not i.
                    updatedNewIndex = i - 1;
                } else {
                    updatedNewIndex = i;
                }
                break;
            }
        }
    }
    return updatedNewIndex;
}

function setPlaceholderAndNoMoveZone() {
    let newPlaceholderTop = findPlaceholderTop();
    yStartNoMoveZone = newPlaceholderTop - 8;
    yEndNoMoveZone = newPlaceholderTop - nothingToPlaceholderOffset;
    placeholderEl.style.transform = `translateY(${newPlaceholderTop}px)`;
}

function findPlaceholderTop() {
    let startIndex = getItemsInContainerStart(toEl);
    let endIndex = getItemsInContainerEnd(toEl);
    let ref, offsetCorrection;
    if (endIndex === startIndex) {
        // We don't have any reference, it will just be at the top.
        // However, the offsetCorrection should probably account for
        // margin/padding.
        ref = null;
        offsetCorrection = 0;
    } else if (toEl === fromEl && newIndex === endIndex - 1) {
        // Last element in fromEl.
        ref = toEl.children[endIndex-1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8 + activeToNothingOffset;
    } else if (toEl !== fromEl && newIndex === endIndex) {
        // Last element, not in fromEl.
        ref = toEl.children[endIndex-1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8;
    } else if (toEl === fromEl && newIndex > oldIndex) {
        ref = toEl.children[newIndex + 1]
        offsetCorrection = activeToNothingOffset;
    } else {
        ref = toEl.children[newIndex]
        offsetCorrection = 0;
    }
    // Correct the ref if we hit an element with display: none.
    // Thanks to endIndex check we know that the ref is either displayed
    // itself or there is a displayed object below it, that we will eventually
    // find..
    while (ref && getComputedStyle(ref).display === 'none') {
        ref = ref.nextElementSibling;
    }
    // This will be the new activeEl's top as well, once we move it.
    return ref ? ref.offsetTop + offsetCorrection : offsetCorrection;
}

function animateMoveInsideContainer(containerEl, previousIndex, newNewIndex) {
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

    // shadow newIndex to avoid using it accidentally
    let newIndex = 'DEATH AND DESTRUCTION!';

    let inFromEl = (fromEl === containerEl);
    let maxItemIndex = getItemsInContainerEnd(containerEl) - 1;
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
        let otherEl = containerEl.children[i];
        if (otherEl === activeEl) continue;

        let afterOld = inFromEl && i >= oldIndex;
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

function stateDrag_window_TouchCancel(event) {
    exitDrag(false);
}
function stateDrag_window_TouchEnd(event) {
    dragEndedWithRelease();
    event.preventDefault();
    event.stopPropagation();
}
function stateDrag_window_PointerUp(event) {
    if (event.pointerId !== pointerId) {
        return;
    }
    dragEndedWithRelease();
}

function dragEndedWithRelease() {
    // We can't really prevent the browser for generating a click, but we
    // can capture it.
    document.addEventListener('click', preventNextClick, true);
    // The click will, however, not necessaily generate (only when there
    // was an element that browser thinks was clicked), so let's make sure
    // the blocker is removed.
    setTimeout(removeClickBlocker, 0);

    // End drag successfully, except when we aren't actually in any container.
    // TODO: Should we have a special handling for touchcancel? OTOH, I don't
    // see it showing up in practice. Maybe except when touch becomes a scroll,
    // but we eliminate that instance.
    exitDrag(toEl !== null);
}

function preventNextClick(event) {
    event.stopPropagation();
    event.preventDefault();
    document.removeEventListener('click', preventNextClick, true);
}
function removeClickBlocker() {
    document.removeEventListener('click', preventNextClick, true);
}

function exitDrag(execSort) {
    let animBackFromFloat = Boolean(floatEl);
    if (floatEl) {
        floatEl.remove();  // Removing this element now saves some special casing.
        floatEl = null;
    }
    if (placeholderEl) {
        placeholderEl.remove();
        placeholderEl = null;
    }
    if (preDragTimeoutId) {
        clearTimeout(preDragTimeoutId);
        preDragTimeoutId = 0;
    }

    let dragEndEvent = {
        dragExecuted: execSort,
        item: activeEl,
        from: fromEl,
        to: execSort ? toEl : null,
        oldIndex,
        newIndex: execSort ? newIndex : null,
    };

    if (execSort && (newIndex !== oldIndex || toEl !== fromEl)) {
        // Note:
        // We need to adjust the position of elements with transform
        // to avoid shifting them around suddenly. It would be nice
        // to do that in one go for each element, but that would involve
        // several cases and so on. I'll just do that as I go, and not
        // worry that I do that twice for some elements most of the time.

        activeEl.remove();

        // Adjust elements after removed and animate them to 0.
        for (let elem of Array.from(fromEl.children).slice(oldIndex)) {
            let currentTransform = (transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] -= activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                transformsByElem.set(elem, currentTransform);
            }
            Anim.start(fromEl, [elem], 0, animMs, currentTransform[1]);
        }


        if (newIndex === toEl.children.length) {
            toEl.appendChild(activeEl);
        } else {
            toEl.children[newIndex].before(activeEl);
        }

        // Adjust elements after inserted and animate them to 0.
        for (let elem of Array.from(toEl.children).slice(newIndex + 1)) {
            let currentTransform = (transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] += activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                transformsByElem.set(elem, currentTransform);
            }
            Anim.start(fromEl, [elem], 0, animMs, currentTransform[1]);
        }
    } else {
        // When cancelling, let's simply tell everyone to go home.
        for (let cont of [fromEl, toEl]) {
            if (cont !== null) {  // toEl may be missing.
                Anim.start(cont, Array.from(cont.children), 0, animMs);
            }
        }
    }

    if (animBackFromFloat) {
        // Our Anim handles only y animation for now, we should fix that.
        // However, let's at least handle the y.
        let activeElRect = activeEl.getClientRects()[0];
        Anim.start(activeEl, [activeEl], 0, animMs, yDragClientPos - activeElRect.top);
    }

    unstyleActiveEl();
    deactivatePlaceholder();

    removeBottomPaddingCorrection();

    if (toEl) {
        // Invoke onContainerLeft here to be consistent with how it's called
        // in leaveContainer - after the container cleanup.
        const toContainerOptions = toEl.omicronDragAndDropData.options;
        if (typeof toContainerOptions.onContainerLeft === 'function') {
            toContainerOptions.onContainerLeft(toEl, activeEl);
        }
    }

    unsetEvents_statePreDrag();
    unsetEvents_stateDrag();

    // Revert the original overscroll behavior.
    document.documentElement.style.overscrollBehavior = htmlOvescrollBehavior;
    document.body.style.overscrollBehavior = bodyOvescrollBehavior;

    pointerId = null;
    activeEl = null;
    floatEl = null;
    fromEl = null;
    toEl = null;
    placeholderEl = null;
    oldIndex = newIndex = 0;
    yDirection = -1;
    scrollers = [];
    knownScrollers = new Map();
    activeScrollers = [];
    forbiddenInsertionIndicesCache = new Map();


    // Finally, let call all the drag-end events.
    // All the callbacks get the same event object.
    const fromContainerOptions = dragEndEvent.from.omicronDragAndDropData.options;

    if (execSort) {
        if (dragEndEvent.to === dragEndEvent.from) {
            if (typeof fromContainerOptions.onInternalChange === 'function') {
                fromContainerOptions.onInternalChange(dragEndEvent);
            }
        } else {
            if (typeof fromContainerOptions.onDropToOtherContainer === 'function') {
                fromContainerOptions.onDropToOtherContainer(dragEndEvent);
            }
            const toContainerOptions = dragEndEvent.to.omicronDragAndDropData.options;
            if (typeof toContainerOptions.onDropFromOtherContainer === 'function') {
                toContainerOptions.onDropFromOtherContainer(dragEndEvent);
            }
        }
    }

    if (typeof fromContainerOptions.onDragFinished === 'function') {
        fromContainerOptions.onDragFinished(dragEndEvent);
    }
}

function anyState_container_PointerEnter(event) {
    let containerData = event.currentTarget.omicronDragAndDropData;
    containerData.domDepth = getDomDepth(event.currentTarget);
    hoverContainers.set(event.currentTarget, containerData);
    if (hoverContainersByDepth.indexOf(containerData) === -1) {
        hoverContainersByDepth.push(containerData);
        hoverContainersByDepth.sort(cmpDomDepth);
    }

    if (!fromEl) {
        // Not dragging anything, so nothing to do.
        return;
    }
    if (event.currentTarget === toEl) {
        // Already in this container, nothing to do.
        return;
    }

    maybeEnterContainer(containerData, event);
}

function anyState_container_PointerLeave(event) {
    let containerData = event.currentTarget.omicronDragAndDropData;
    hoverContainers.delete(event.currentTarget);
    let delIdx;
    if ((delIdx = hoverContainersByDepth.indexOf(containerData)) !== -1) {
        hoverContainersByDepth.splice(delIdx, 1);
    }

    if (event.currentTarget !== toEl) {
        return; // Not relevant.
    }

    if (event.buttons === 0) {
        // This PointerLeave event was caused by releasing the touch or
        // button. Don't call leaveContainer, the subsequent PointerUp
        // or TouchEnd will handle the end of the drag instead.
        return;
    }

    leaveContainer();

    // mousemove handler will figure the container to enter.
    // TODO: if it gets glitchy, call the mousemove handler here directly.
}

function maybeEnterContainer(containerData, evPlace) {
    let cData = containerData;
    let rect = cData.el.getClientRects()[0];
    if (!rect) {
        return false;
    }
    if (xLast >= rect.left + rect.width * cData.options.enterGuardLeft + cData.options.enterGuardLeftPx &&
            xLast <= rect.right - rect.width * cData.options.enterGuardRight - cData.options.enterGuardRightPx) {
        let insertionIndex = findUpdatedNewIndex(evPlace, cData.el);
        if (!isForbiddenIndex(cData.el, insertionIndex)) {
            enterContainer(cData.el, insertionIndex);
            return true;
        }
    }
    return false;
}

function enterContainer(newToEl, insertionIndex) {
    if (toEl !== null) {
        // Handle removal from the previous container.
        leaveContainer();
    }

    // Then handle insertion into the new container.
    toEl = newToEl;

    scrollers = collectScrollers(toEl);

    createPlaceholder();

    addBottomPaddingCorrection();

    newIndex = insertionIndex;
    animateMoveInsideContainer(toEl, getItemsInContainerEnd(toEl), newIndex);

    setPlaceholderAndNoMoveZone();
    activatePlaceholder();

    const containerOptions = toEl.omicronDragAndDropData.options;
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(fromEl, activeEl);
    }
}

function leaveContainer() {
    deactivatePlaceholder();

    animateMoveInsideContainer(toEl, newIndex, getItemsInContainerEnd(toEl));

    removeBottomPaddingCorrection();

    const leftContainerEl = toEl;

    toEl = null;

    const containerOptions = leftContainerEl.omicronDragAndDropData.options;
    if (typeof containerOptions.onContainerLeft === 'function') {
        containerOptions.onContainerLeft(leftContainerEl, activeEl, void 0);
    }
}

const minScrollSpeed = 0.3; // In pixels per millisecond.
const maxScrollSpeed = 0.7; // In pixels per millisecond.
const maxScrollSpeedIncrease = maxScrollSpeed - minScrollSpeed;

function animationFrame(timestamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    if (floatEl) {
        // TODO: adjust for scroll or other changes of the base.
        floatEl.style.transform = `translate(${xDragClientPos}px,${yDragClientPos}px)`;
    }
    let needsNextFrame = false;
    if (activeScrollers.length !== 0) {
        needsNextFrame = true;
        if (lastScrollAnimationTimestamp) {
            let frameTime = timestamp - lastScrollAnimationTimestamp;
            // Animate. If lastScrollAnimationTimestamp is not set, the animation
            // will start on the next frame.
            for (let i = 0; i < activeScrollers.length; ++i) {
                let s = activeScrollers[i];
                let scrollSpeed = minScrollSpeed + s.speedInput * maxScrollSpeedIncrease;
                if (s.vertical) {
                    const diff = s.vertical * scrollSpeed * frameTime;
                    s.scrollerEl.scrollTop += diff;
                    updateScrollerRects(i, diff, 0);
                }
                if (s.horizontal) {
                    const diff = s.horizontal * scrollSpeed * frameTime;
                    s.scrollerEl.scrollLeft += diff;
                    updateScrollerRects(i, 0, diff);
                }
            }
        }
        lastScrollAnimationTimestamp = timestamp;
    }
    // Iterate backwards to allow simple removal.
    for (let i = anims.length - 1; i >= 0; --i) {
        if (anims[i].animationFrame(timestamp)) {
            needsNextFrame = true;
        } else {
            anims[i].remove();
        }
    }
    if (needsNextFrame) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}

function updateScrollerRects(updateBefore, vDiff, hDiff) {
    for (let i = 0; i < updateBefore; ++i) {
        const rect = scrollers[i].rect;
        rect.top -= vDiff;
        rect.bottom -= vDiff;
        rect.left -= hDiff;
        rect.right -= hDiff;
    }
}

function createPlaceholder() {
    placeholderEl = document.createElement('div');
    placeholderEl.style.position = 'absolute';
    placeholderEl.style.top = 0;
    placeholderEl.style.zIndex = 1;
    placeholderEl.style.background = 'lightgray';
    placeholderEl.style.userSelect = 'none';
    placeholderEl.style.pointerEvents = 'none';
    placeholderEl.style.visibility = 'hidden';
    placeholderEl.classList.add('drag-placeholder');
    // Note: that may be before or after floatEl. Maybe that is the problem?
    toEl.appendChild(placeholderEl);
    // Set the height only if not set externally.
    let autoHeight = getComputedStyle(placeholderEl).height;
    if (!autoHeight || autoHeight === '0px') {
        placeholderEl.style.height = Math.min(activeEl.offsetHeight - 16, 200) + 'px';
    }
    // TODO: Figure out how to determine these properly. I guess we need to take
    // the container's clientWidth and make the actual math with margins and
    // stuff.
    // For now let's assume that the offsets on activeEl are ok and that
    // they are the same on both sides.
    placeholderEl.style.left = activeEl.offsetLeft + 'px';
    placeholderEl.style.right = activeEl.offsetLeft + 'px';
    // nothingToPlaceholderOffset may be different in different containers,
    // as different containers may have differe placeholder height.
    nothingToPlaceholderOffset = placeholderEl.offsetHeight + 8;
}

function activatePlaceholder() {
    placeholderEl.style.visibility = 'visible';
}

function deactivatePlaceholder() {
    if (placeholderEl) {
        placeholderEl.remove();
    }
    placeholderEl = null;
}

function addBottomPaddingCorrection() {
    if (toEl !== fromEl) {
        toEl.style.paddingBottom =
            parseFloat(getComputedStyle(toEl).paddingBottom.slice(0, -2)) + nothingToPlaceholderOffset + 'px';
    }
}

function removeBottomPaddingCorrection() {
    if (toEl !== null && toEl !== fromEl) {
        // Reset extended padding.
        toEl.style.paddingBottom = null;
    }
}

function styleActiveEl() {
    // Theoretically some descendants can have visibility set explicitly
    // to visible and then whey would be visible anyway, so let's double
    // down with opacity: 0;
    activeEl.style.visibility = 'hidden';
    activeEl.style.opacity = 0;
    activeEl.style.pointerEvents = 'none';
    activeEl.classList.add('drag-active-item');
}

function unstyleActiveEl() {
    // Note: if there were any inline styles on the element, uh, we have
    // just erased them. I think that is resonable to force users to just
    // deal with it.
    activeEl.classList.remove('drag-active-item');
    activeEl.style.visibility = null;
    activeEl.style.opacity = null;
    activeEl.style.pointerEvents = null;
}

function createFloatEl() {
    floatEl = activeEl.cloneNode(true);

    floatEl.style.position = 'fixed';
    floatEl.style.left = 0;
    floatEl.style.top = 0;
    floatEl.style.margin = 0;
    floatEl.style.zIndex = 10000000;
    floatEl.style.pointerEvents = 'none';

    floatEl.style.width = getComputedStyle(activeEl).width;
    floatEl.style.transform = `translate(${xDragClientPos}px,${yDragClientPos}px)`;
    floatEl.classList.add('drag-float-item');

    // Position fixed is great, but it has limitation: if any ancestor
    // has transform, perspective, or filter property set other than none,
    // it becomes the containing block instead of the viewport, and your
    // perfect plan for positioning gets royally screwed. That is why we
    // need to put the floatEl directly on document.body.
    //
    // We may some day add an option to put it on the container, a counterpart
    // to Sortable's fallbackOnBody, but for now we just need it outside
    // and free of any rogue containing block candidates.
    document.body.appendChild(floatEl);
}

// Utils.

// There is a sneaky subtlety in using forbiddenIndices, as for elements
// in fromEl after oldIndex the newIndex refers not to the object we would
// inserting before, but instead the one we will be inserting after (i.e.
// everything is shifted by one index).
// In order to simplify writing forbiddenInsertionIndicesFns, I make it
// ignore the shift (i.e. return the same values regardless whether the
// given container is fromEl or not), and make the correction here instead.
// The important caveat is that forbiddenIndices set should always be read
// through this function.
function isForbiddenIndex(containerEl, index) {
    // TODO: Optimize for getting forbidden index from toEl? We are almost
    // always looking at the toEl anyway.
    let forbiddenIndices = getForbiddenInsertionIndices(containerEl);
    if (containerEl === fromEl && index > oldIndex) {
        return forbiddenIndices.has(index + 1);
    }
    return forbiddenIndices.has(index);
}

function getForbiddenInsertionIndices(containerEl) {
    let cachedValue = forbiddenInsertionIndicesCache.get(containerEl);
    if (cachedValue) {
        return cachedValue;
    }
    const fn =
        containerEl.omicronDragAndDropData.options.forbiddenInsertionIndicesFn;
    let newValue;
    if (typeof fn === 'function') {
        newValue = new Set(fn(containerEl, activeEl));
    } else {
        newValue = new Set();
    }
    forbiddenInsertionIndicesCache.set(containerEl, newValue);
    return newValue;
}

function collectScrollers(elem) {
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
        let rect = elem.getClientRects()[0];
        let record = knownScrollers.get(elem);
        if (record) {
            record.rect = rect; // Update the rect.
        } else {
            record = {
                el: elem,
                rect,
                horizontal: horizontalScroll,
                vertical: verticalScroll,
                snap: Boolean(elem.dataset.omicronScrollSnap),
                snapCooldown: false,
            };
            knownScrollers.set(elem, record);
        }
        result.push(record);
    }
    return result;
}

// Compare function for hoverContainersByDepth.
function cmpDomDepth(a, b) {
    return b.domDepth - a.domDepth;
}

// Get elem's depth in the DOM tree.
// Note: no special handling for elements not attached to actual document.
function getDomDepth(elem) {
    let result = 0;
    for (elem = elem && elem.parentElement; elem; elem = elem.parentElement) {
        ++result;
    }
    return result;
}

// Get the first index for items that we consider for drag and drop
// end positioning. Skip anything with display: none.
function getItemsInContainerStart(containerEl) {
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
function getItemsInContainerEnd(containerEl) {
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

// Anim is implemented to hold an array of elems, but we actually rely on it
// holding only one (which means we can delete the whole old anim when adding
// new one for the same element).
class Anim {
    static start(parentEl, elems, targetYTranslation, durationMs, startYTranslation) {
        // How the actual, visible position differs from offsetTop.
        if (typeof startYTranslation === 'undefined') {
            // TODO: Group the elements with the same initial translation.
            // Round the initial translation to avoid sub-pixel differences.
            // Alternatively work it around so that we _know_ all elements
            // have the same starting transform - generating all these rects
            // is a lot of useless computation and allocation.
            for (let elem of elems) {
                startYTranslation = (transformsByElem.get(elem) || [0, 0])[1];
                if (startYTranslation !== targetYTranslation) {
                Anim.add(elem, new Anim(parentEl, [elem], startYTranslation, targetYTranslation, durationMs));
                } else {
                let currentAnim = animsByElem.get(elem);
                if (currentAnim) {
                    currentAnim.remove();
                }
                }
            }
        } else {
            // Immediately make sure that the elements are where they are supposed to start.
            let transformString = `translateY(${startYTranslation}px)`;
            for (let elem of elems) {
                elem.style.transform = transformString;
                Anim.add(elem, new Anim(parentEl, [elem], startYTranslation, targetYTranslation, durationMs));
            }
        }
        if (!animFrameRequestId) {
            animFrameRequestId = requestAnimationFrame(animationFrame);
        }
    }

    /* private */ static add(elem, anim) {
        // Replace any old anim for this elem.
        let previousAnim = animsByElem.get(elem);
        if (previousAnim) {
            anims[anims.indexOf(previousAnim)] = anim;
        } else {
        anims.push(anim);
        }
        animsByElem.set(elem, anim);
    }

    /* private */ constructor(parentEl, elems, startYTranslation, targetYTranslation, durationMs) {
        // assert(elems.length);
        this.parentEl = parentEl;
        this.elems = elems;
        this.startYTranslation = startYTranslation;
        this.targetYTranslation = targetYTranslation;
        this.durationMs = durationMs;
        this.startTime = null;  // Will be filled in in the animation frame.
        this.endTime = null;
    }

    // Will return true if the next frame should be requested.
    animationFrame(timestamp) {
        if (!this.startTime) {
            this.startTime = timestamp;
            this.endTime = timestamp + this.durationMs;
            return true;  // Do nothing
        }
        let advancementRate =
            timestamp >= this.endTime ? 1 : (timestamp - this.startTime) / this.durationMs;
        let currentYTranslation =
            advancementRate * this.targetYTranslation + (1 - advancementRate) * this.startYTranslation;
        let transformString = `translateY(${currentYTranslation}px)`;
        for (let elem of this.elems) {
            if (currentYTranslation === 0) {
                transformsByElem.delete(elem);
            } else {
                transformsByElem.set(elem, [0, currentYTranslation]);
            }
            elem.style.transform = transformString;
        }
        return (advancementRate < 1);
    }

    remove() {
    for (let elem of this.elems) {
        animsByElem.delete(elem);
    }
    anims[anims.indexOf(this)] = anims[anims.length - 1];
    anims.pop();
    }
}

function getItemFromContainerEvent(event, options) {
    let containerEl = event.currentTarget;
    let result = null;
    let handleFound = false;
    for (let el = event.target; el !== containerEl; el = el.parentElement) {
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
            result !== placeholderEl &&
            (!options.draggableSelector || result.matches(options.draggableSelector)) &&
            (handleFound || !options.handleSelector))
        return result;
    else {
        return null;
    }
}

export default {
    init: initDragContainer,
};
