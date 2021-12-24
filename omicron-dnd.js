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

const defaultOptions = {
    draggableSelector: null,
    filterSelector: null,
    handleSelector: null,
    // Guards without suffix are a rate of width, those with 'px' are in pixels.
    enterGuardLeft: 0,
    enterGuardLeftPx: 0,
    enterGuardRight: 0,
    enterGuardRightPx: 0,
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
    containerEl.addEventListener('pointerdown', anyState_container_PointerDown);
    containerEl.addEventListener('pointerenter', anyState_container_PointerEnter);
    containerEl.addEventListener('pointerleave', anyState_container_PointerLeave);
    containerEl.omicronDragAndDropData = containerData;
    // There is no touchenter. :(
    // TODO: Work it around with pointerevents or mousemove on all containers.
    // PointerEvents look preferable anyway, unless there is some big caveat,
    // and seem to have enough support to just assume they are reliable.
}
function setEvents_statePreDrag() {
    if (touchDrag) {
        // Seems like we need to catch the touchmove from the get-go?
        window.addEventListener('touchmove', statePreDrag_window_TouchMove);
    }
    window.addEventListener('pointermove', statePreDrag_window_PointerMove);
    window.addEventListener('pointerup', statePreDrag_window_PointerUp, true);
}
function unsetEvents_statePreDrag() {
    if (touchDrag) {
        window.removeEventListener('touchmove', statePreDrag_window_TouchMove);
    }
    window.removeEventListener('pointermove', statePreDrag_window_PointerMove);
    window.removeEventListener('pointerup', statePreDrag_window_PointerUp, true);
}
function setEvents_stateDrag() {
    if (touchDrag) {
        // For preventing multi-touch while dragging.
        window.addEventListener('touchdown', stateDrag_window_TouchDown);
        // We need to capture touchmove events in order to call
        // .preventDefault() on them and stop the scrolling.
        // Calling .preventDefault() on PointerEvents doesn't do that.
        window.addEventListener('touchmove', stateDrag_window_TouchMove, {passive: false});
    }
    window.addEventListener('pointermove', stateDrag_window_PointerMove);
    window.addEventListener('pointerup', stateDrag_window_PointerUp, true);
}
function unsetEvents_stateDrag() {
    if (touchDrag) {
        window.removeEventListener('touchdown', stateDrag_window_TouchDown);
        window.removeEventListener('touchmove', stateDrag_window_TouchMove, {passive: false});
    }
    window.removeEventListener('pointermove', stateDrag_window_PointerMove);
    window.removeEventListener('pointerup', stateDrag_window_PointerUp, true);
}
function anyState_container_PointerDown(event) {
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

    // Pointermove events are by default all captured by the pointerdown's target.
    // That means no pointerenter/pointerleave events, that we rely on, so
    // we need to release the pointer capture.
    // Source: https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
    event.target.releasePointerCapture(event.pointerId);

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
    activeEl = getItemFromContainerEvent(event, containerData.options);
    if (!activeEl) {
        // TODO: Add an option to .stopPropagation() here as well, to prevent
        // dragging the container by elements, event if not by the handle?
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
    return true;
}

function startDrag() {
    if (preDragTimeoutId) {
        clearTimeout(preDragTimeoutId);
        preDragTimeoutId = 0;
    }

    unsetEvents_statePreDrag();
    setEvents_stateDrag();

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

    styleActiveEl();

    yStartNoMoveZone = activeEl.offsetTop - 8;
    // We need to compute the end from the top, and use placeholder's
    // height instead of the element's height.
    yEndNoMoveZone = activeEl.offsetTop - nothingToPlaceholderOffset;

    // Note: this is a string with px.

    let childrenArray = Array.from(fromEl.children);
    newIndex = oldIndex = childrenArray.indexOf(activeEl);
    // Use getItemsInContainerCount() to skip placeholder at the end.
    let itemsAfter = childrenArray.slice(oldIndex + 1, getItemsInContainerCount(fromEl));
    Anim.start(fromEl, itemsAfter, activeToPlaceholderOffset, animMs);
}
function statePreDrag_window_TouchMove(event) {
    // empty, statePreDrag_window_PointerMove does the work
}
function statePreDrag_window_PointerMove(event) {
    if (event.pointerId !== pointerId) {
        return;
    }
    if (touchDrag) {
        // We may not be able to cancel the scroll any more after this event,
        // so we have to give up the drag.
        exitDrag(false);
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
    // Prevent scroll.
    event.preventDefault();
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
    if (hoverContainersByDepth[0] && hoverContainersByDepth[0].el !== toEl) {
        // TODO: Make it a loop and allow stacking this behavior instead
        // of limiting it to the deepest level.
        if (maybeEnterContainer(hoverContainersByDepth[0], evtPoint)) {
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

    if (updatedNewIndex != newIndex) {
        let previousIndex = newIndex;
        newIndex = updatedNewIndex;
        animateMoveInsideContainer(toEl, previousIndex, updatedNewIndex);

        setPlaceholderAndNoMoveZone();
    }
}

function updateActiveScrollers() {
    // TODO: Remove array allocation?
    activeScrollers = [];
    for (let i = 0; i < scrollers.length; ++i) {
        for (let triggerZone of scrollers[i].triggerZones) {
            if (xLast >= triggerZone.rect.left &&
                    xLast <= triggerZone.rect.right &&
                    yLast >= triggerZone.rect.top &&
                    yLast <= triggerZone.rect.bottom) {
                activeScrollers.push({
                    scrollerIndex: i,
                    scrollerEl: scrollers[i].el,
                    horizontal: triggerZone.horizontal,
                    vertical: triggerZone.vertical,
                    speedInput: computeScrollerSpeedInput(triggerZone),
                });
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

function computeScrollerSpeedInput(triggerZone) {
    let rect = triggerZone.rect;
    if (triggerZone.horizontal) {
        let rateFromLeft = (xLast - rect.left) / (rect.right - rect.left);
        return (triggerZone.horizontal === 1) ? rateFromLeft : 1 - rateFromLeft;
    } else {
        let rateFromTop = (yLast - rect.top) / (rect.bottom - rect.top);
        return (triggerZone.vertical === 1) ? rateFromTop : 1 - rateFromTop;
    }
}

// By default, we optimize the search by going only from the current index
// in the direction of mouseY, and only when the move is outside of
// precomputed zone where we know no move happened. When ignoreCurrentNewIndex
// is true, we ignore both optimization, which is useful for computing
// the index in a new container.
function findUpdatedNewIndex(evtPoint, ignoreCurrentNewIndex) {
    // TODO: There is some glitch in how mouseY works after autoscroll.
    // I don't know what the issue is, but there is some shift introduced,
    // perhaps at this place.
    let mouseY = evtPoint.clientY - toEl.getClientRects()[0].top;

    let updatedNewIndex = newIndex;

    let wiggleZoneSize = 0.5;
    let snapMargin = (1 - wiggleZoneSize) / 2;
    let bottomSnapBorder = yDirection === -1 ? (1 - snapMargin) : snapMargin;
    let itemsInContainer = getItemsInContainerCount(toEl);
    if (ignoreCurrentNewIndex || mouseY < yStartNoMoveZone && newIndex !== 0) {
        // Correct for the fact that if we dragged the element down from
        // its place, some elements above it are shifted from their
        // offset position.
        let offsetCorrection = toEl === fromEl ? activeToNothingOffset : 0;
        updatedNewIndex = 0;
        // We may look up one extra element at the start, but that is not an issue.
        let iterationStart = itemsInContainer - 1;
        if (!ignoreCurrentNewIndex && newIndex < iterationStart) {
            iterationStart
        }
        for (let i = iterationStart; i >= 0; --i) {
            let otherEl = toEl.children[i];
            if (otherEl === activeEl) continue;
            if (i < oldIndex) {
                // We could check for (toEl === fromEl) here, but the
                // value is going to be 0 anyway.
                offsetCorrection = 0;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY > otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl after otherEl.
                if (toEl === fromEl && i > oldIndex) {
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
        updatedNewIndex = (toEl === fromEl) ? itemsInContainer - 1 : itemsInContainer;
        // We may look up one extra element at the start, but that is not an issue.
        for (let i = newIndex; i < itemsInContainer; ++i) {
            let otherEl = toEl.children[i];
            if (otherEl === activeEl) continue;  // May still happen.
            if (i > oldIndex && toEl === fromEl) {
                offsetCorrection = activeToPlaceholderOffset;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY < otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl before otherEl.
                if (toEl === fromEl && i > oldIndex) {
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
    let itemsInContainer = getItemsInContainerCount(toEl);
    let ref, offsetCorrection;
    if (itemsInContainer === 0) {
        // We don't have any reference, it will just be at the top.
        // However, the offsetCorrection should probably account for
        // margin/padding.
        ref = null;
        offsetCorrection = 0;
    } else if (toEl === fromEl && newIndex === itemsInContainer - 1) {
        // Last element in fromEl.
        ref = toEl.children[itemsInContainer-1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8 + activeToNothingOffset;
    } else if (toEl !== fromEl && newIndex === itemsInContainer) {
        // Last element, not in fromEl.
        ref = toEl.children[itemsInContainer-1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8;
    } else if (toEl === fromEl && newIndex > oldIndex) {
        ref = toEl.children[newIndex + 1]
        offsetCorrection = activeToNothingOffset;
    } else {
        ref = toEl.children[newIndex]
        offsetCorrection = 0;
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
    let maxItemIndex = getItemsInContainerCount(containerEl) - 1;
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

function stateDrag_window_PointerUp(event) {
    if (event.pointerId !== pointerId) {
        return;
    }
    // End drag successfully, except when we aren't actually in any container.
    // TODO: Should we have a special handling for touchcancel? OTOH, I don't
    // see it showing up in practice. Maybe except when touch becomes a scroll,
    // but we eliminate that instance.
    exitDrag(toEl !== null);
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
        return // Not relevant.
    }

    leaveContainer();

    // mousemove handler will figure the container to enter.
    // TODO: if it gets glitchy, call the mousemove handler here directly.
}

function maybeEnterContainer(containerData, evPlace) {
    let cData = containerData;
    let rect = cData.el.getClientRects()[0];
    if (xLast >= rect.left + rect.width * cData.options.enterGuardLeft + cData.options.enterGuardLeftPx &&
            xLast <= rect.right - rect.width * cData.options.enterGuardRight - cData.options.enterGuardRightPx) {
        enterContainer(cData.el, evPlace);
        return true;
    }
    return false;
}

function enterContainer(newToEl, evPlace) {
    if (toEl !== null) {
        // Handle removal from the previous container.
        leaveContainer();
    }

    // Then handle insertion into the new container.
    toEl = newToEl;

    scrollers = collectScrollers(toEl);

    createPlaceholder();

    newIndex = findUpdatedNewIndex(evPlace, /*ignoreCurrentNewIndex=*/true);
    animateMoveInsideContainer(toEl, getItemsInContainerCount(toEl), newIndex);

    setPlaceholderAndNoMoveZone();
    activatePlaceholder();
}

function leaveContainer() {
    deactivatePlaceholder();

    animateMoveInsideContainer(toEl, newIndex, getItemsInContainerCount(toEl));

    toEl = null;
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
            for (let s of activeScrollers) {
                let scrollSpeed = minScrollSpeed + s.speedInput * maxScrollSpeedIncrease;
                if (s.vertical) {
                    const diff = s.vertical * scrollSpeed * frameTime;
                    s.scrollerEl.scrollTop += diff;
                    updateScrollerRects(s.i + 1, diff, 0);
                }
                if (s.horizontal) {
                    const diff = s.horizontal * scrollSpeed * frameTime;
                    s.scrollerEl.scrollLeft += diff;
                    updateScrollerRects(s.i + 1, 0, diff);
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

function updateScrollerRects(firstIndexToUpdate, vDiff, hDiff) {
    for (let i = firstIndexToUpdate; i < scrollers.length; ++i) {
        for (let triggerZone of scrollers[i].triggerZones) {
            let rect = triggerZone.rect;
            rect.top -= vDiff;
            rect.bottom -= vDiff;
            rect.left -= hDiff;
            rect.right -= hDiff;
        }
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

const scrollActivationMargin = 80; // In pixels. TODO: Allow adjusting with element markup.

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
        let triggerZones = [];
        if (horizontalScroll) {
            triggerZones.push({
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.left + scrollActivationMargin,
                    bottom: rect.bottom,
                },
                horizontal: -1, // scrolling left, i.e. scrollLeft decreasing
                vertical: null,
            }, {
                rect: {
                    left: rect.right - scrollActivationMargin,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                },
                horizontal: 1, // scrolling right, i.e. scrollLeft increasing
                vertical: null,
            });
        }
        if (verticalScroll) {
            triggerZones.push({
                rect: {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.top + 40,
                },
                horizontal: null,
                vertical: -1, // scrolling up, i.e. scrollTop decreasing
            }, {
                rect: {
                    left: rect.left,
                    top: rect.bottom - 40,
                    right: rect.right,
                    bottom: rect.bottom,
                },
                horizontal: null,
                vertical: 1, // scrolling down, i.e. scrollTop increasing
            });
        }
        result.push({
            el: elem,
            horizontalScroll,
            verticalScroll,
            triggerZones,
        });
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

function getItemsInContainerCount(containerEl) {
    let lastIndex = containerEl.children.length - 1;
    let lastItemCandidate = containerEl.lastElementChild;
    if (!lastItemCandidate) {
        return 0;
    }
    while (
        lastItemCandidate && (
            lastItemCandidate === floatEl ||
            lastItemCandidate === placeholderEl)) {
        lastItemCandidate = lastItemCandidate.previousElementSibling;
        --lastIndex;
    }
    return lastIndex + 1;
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
