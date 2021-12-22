const animMs = 100;

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

let anims = [];
let animsByElem = new Map();
// elem => [x, y]; no [0, 0] stored.
let transformsByElem = new Map();

const minimalMoveMouse = 5;
const delay = 220;

function initDragContainer(containerEl) {
    containerEl.addEventListener('mousedown', anyState_container_MouseDown);
    containerEl.addEventListener('touchstart', anyState_container_MouseDown);
    containerEl.addEventListener('mouseenter', anyState_container_MouseEnter);
    // There is no touchenter. :(
    // TODO: Work it around with pointerevents or mousemove on all containers.
    // PointerEvents look preferable anyway, unless there is some big caveat,
    // and seem to have enough support to just assume they are reliable.
}
function setEvents_statePreDrag() {
    window.addEventListener('mousemove', statePreDrag_window_MouseMove);
    window.addEventListener('touchmove', statePreDrag_window_MouseMove);
    window.addEventListener('mouseup', statePreDrag_window_MouseUp, true);
    window.addEventListener('touchend', statePreDrag_window_MouseUp, true);
    window.addEventListener('touchcancel', statePreDrag_window_MouseUp, true);
}
function unsetEvents_statePreDrag() {
    window.removeEventListener('mousemove', statePreDrag_window_MouseMove);
    window.removeEventListener('touchmove', statePreDrag_window_MouseMove);
    window.removeEventListener('mouseup', statePreDrag_window_MouseUp, true);
    window.removeEventListener('touchend', statePreDrag_window_MouseUp, true);
    window.removeEventListener('touchcancel', statePreDrag_window_MouseUp, true);
}
function setEvents_stateDrag() {
    window.addEventListener('mousemove', stateDrag_window_MouseMove, {passive: false});
    window.addEventListener('touchmove', stateDrag_window_MouseMove, {passive: false});
    window.addEventListener('mouseup', stateDrag_window_MouseUp, true);
    window.addEventListener('touchend', stateDrag_window_MouseUp, true);
    window.addEventListener('touchcancel', stateDrag_window_MouseUp, true);
}
function unsetEvents_stateDrag() {
    window.removeEventListener('mousemove', stateDrag_window_MouseMove, {passive: false});
    window.removeEventListener('touchmove', stateDrag_window_MouseMove, {passive: false});
    window.removeEventListener('mouseup', stateDrag_window_MouseUp, true);
    window.removeEventListener('touchend', stateDrag_window_MouseUp, true);
    window.removeEventListener('touchcancel', stateDrag_window_MouseUp, true);
}
function anyState_container_MouseDown(event) {
    let isTouch = Boolean(event.touches);
    let evPlace = getRelevantMouseEventOrTouchOrExitOnDoubleTouch(event);
    if (!evPlace || (!isTouch && event.button !== 0)) {
        return;
    }

    event.stopPropagation();

    touchDrag = isTouch;
    activeEl = getItemFromContainerEvent(event);
    if (!activeEl) {
        return;
    }

    toEl = fromEl = event.currentTarget;

    setEvents_statePreDrag();

    xInitial = xLast = evPlace.clientX;
    yInitial = yLast = evPlace.clientY;
    initialActiveElRect = activeEl.getClientRects()[0];

    // We are in statePreDrag. We will start the drag after a delay, or if
    // the mouse moves sufficiently far. We will cancel the drag if the touch
    // moves too far before the delay.
    preDragTimeoutId = setTimeout(startDrag, delay);
}
function startDrag() {
    console.log('Drag start');
    if (preDragTimeoutId) {
        clearTimeout(preDragTimeoutId);
        preDragTimeoutId = 0;
    }

    unsetEvents_statePreDrag();
    setEvents_stateDrag();

    // Prevent the scroll-to-refresh behavior and the effect
    // of bumping into the scroll end on mobile.
    // TODO: call it only after the delay.
    htmlOvescrollBehavior = document.documentElement.style.ovescrollBehavior;
    bodyOvescrollBehavior = document.body.style.ovescrollBehavior;
    document.documentElement.style.ovescrollBehavior = 'none';
    document.body.style.ovescrollBehavior = 'none';

    // I add some arbitrary difference to give the effect of the element
    // snapping out of place, instead of just staying in place silently.
    xCursorOffset = initialActiveElRect.left - xInitial + 16;
    yCursorOffset = initialActiveElRect.top - yInitial - 4;
    xDragClientPos = xLast + xCursorOffset;
    yDragClientPos = yLast + yCursorOffset;

    createPlaceholder();

    const activeElHeight = activeEl.offsetHeight;

    activeToPlaceholderOffset = placeholderEl.offsetHeight - activeElHeight;
    activeToNothingOffset = -activeElHeight - 8;
    nothingToPlaceholderOffset = placeholderEl.offsetHeight + 8;

    placeholderEl.style.transform = `translateY(${activeEl.offsetTop}px)`;
    activatePlaceholder(placeholderEl);

    createFloatEl();

    styleActiveEl();

    yStartNoMoveZone = activeEl.offsetTop - 8;
    // We need to compute the end from the top, and use placeholder's
    // height instead of the element's height.
    yEndNoMoveZone = activeEl.offsetTop - nothingToPlaceholderOffset;

    // Note: this is a string with px.

    let childrenArray = Array.from(fromEl.children);
    newIndex = oldIndex = childrenArray.indexOf(activeEl);
    // Skip 2 elements at the end: the placeholder and floatEl.
    let itemsAfter = childrenArray.slice(oldIndex + 1, -2);
    Anim.start(fromEl, itemsAfter, activeToPlaceholderOffset, animMs);
}
function statePreDrag_window_MouseMove(event) {
    let evPlace = getRelevantMouseEventOrTouchOrExitOnDoubleTouch(event);
    if (!evPlace) {
        return;
    }
    if (touchDrag) {
        // We may not be able to cancel the scroll any more after this event,
        // so we have to give up the drag.
        exitDrag(false);
        return;
    }
    xLast = evPlace.clientX;
    yLast = evPlace.clientY;
    let xDiff = xLast - xInitial;
    let yDiff = xLast - xInitial;
    let distanceSquaredFromInitial = xDiff * xDiff + yDiff * yDiff;
    if (distanceSquaredFromInitial >  minimalMoveMouse * minimalMoveMouse) {
        console.log('Drag started after mouse move');
        startDrag();
    }
}
function statePreDrag_window_MouseUp(event) {
    // For touchDrag, getRelevantMouseEventOrTouchOrExitOnDoubleTouch will
    // already call exitDrag(false), but that's what we were going to
    // call anyway, so it's fine. However, if we ever want more logic here,
    // it will be necessary to add slightly different event checking.
    let evPlace = getRelevantMouseEventOrTouchOrExitOnDoubleTouch(event);
    if (!evPlace || (!touchDrag && event.button !== 0)) {
        return;
    }
    exitDrag(false);
}
function stateDrag_window_MouseMove(event) {
    let evPlace = getRelevantMouseEventOrTouchOrExitOnDoubleTouch(event);
    if (!evPlace) {
        return;
    }

    // Prevent scroll.
    event.preventDefault();

    // Update the mouse position.
    if (evPlace.clientY !== yLast) {
        yDirection = evPlace.clientY > yLast ? 1 : -1;
    }
    xLast = evPlace.clientX;
    yLast = evPlace.clientY;
    xDragClientPos = xLast + xCursorOffset;
    yDragClientPos = yLast + yCursorOffset;

    // Update the position of floatEl before the next frame.
    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }

    let updatedNewIndex = findUpdatedNewIndex(evPlace);

    if (updatedNewIndex != newIndex) {
        let previousIndex = newIndex;
        newIndex = updatedNewIndex;
        animateMoveInsideContainer(toEl, previousIndex, updatedNewIndex);

        setPlaceholderAndNoMoveZone();
    }
}

// By default, we optimize the search by going only from the current index
// in the direction of mouseY, and only when the move is outside of
// precomputed zone where we know no move happened. When ignoreCurrentNewIndex
// is true, we ignore both optimization, which is useful for computing
// the index in a new container.
function findUpdatedNewIndex(mouseEventvOrTouch, ignoreCurrentNewIndex) {
let mouseY = mouseEventvOrTouch.clientY - toEl.getClientRects()[0].top;

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

function stateDrag_window_MouseUp(event) {
    // We don't actually need any "place", but this is a common way to verify
    // that this is a relevant event.
    let isTouch = Boolean(event.touches);
    if (isTouch !== touchDrag) {
        // Different pointer than what we started the drag with, ignore.
        return;
    }
    if (!touchDrag && event.button !== 0) {
        return;
    }
    // End drag successfully, except when it ended with touchcancel.
    exitDrag(event.type !== 'touchcancel');
}

function exitDrag(execSort) {
    let animBackFromFloat = Boolean(floatEl);
    if (floatEl) {
        floatEl.remove();  // Removing this element now saves some special casing.
        floatEl = null;
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
        for (let elem of Array.from(fromEl.children).slice(oldIndex, -1)) {
            let currentTransform = (transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] -= activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                transformsByElem.set(elem, currentTransform);
            }
            Anim.start(fromEl, [elem], 0, animMs, currentTransform[1]);
        }


        // Thanks to the placeholder, we don't need to special case
        // inserting at the last place, as it is always before the
        // placeholder.
        toEl.children[newIndex].before(activeEl);

        // Adjust elements after inserted and animate them to 0.
        for (let elem of Array.from(toEl.children).slice(newIndex + 1, -1)) {
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
            let itemsArray = Array.from(cont.children).slice(0, -1);
            Anim.start(cont, itemsArray, 0, animMs);
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
    document.documentElement.style.ovescrollBehavior = htmlOvescrollBehavior;
    document.body.style.ovescrollBehavior = bodyOvescrollBehavior;

    activeEl = null;
    floatEl = null;
    fromEl = null;
    toEl = null;
    placeholderEl = null;
    oldIndex = newIndex = 0;
    yDirection = -1;
}

function anyState_container_MouseEnter(event) {
    if (!fromEl) {
        // Not dragging anything, so nothing to do.
        return;
    }
    if (event.currentTarget === toEl) {
        // Already in this container, nothing to do.
        return;
    }

    // Handle removal from the previous container.
    deactivatePlaceholder();

    animateMoveInsideContainer(toEl, newIndex, getItemsInContainerCount(toEl));

    // Then handle insertion into the new container.
    toEl = event.currentTarget;

    newIndex = findUpdatedNewIndex(event, /*ignoreCurrentNewIndex=*/true);
    animateMoveInsideContainer(toEl, getItemsInContainerCount(toEl), newIndex);

    createPlaceholder();
    setPlaceholderAndNoMoveZone();
    activatePlaceholder();
}

function animationFrame(timestamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    if (floatEl) {
        // TODO: adjust for scroll or other changes of the base.
        floatEl.style.transform = `translate(${xDragClientPos}px,${yDragClientPos}px)`;
    }
    let needsNextFrame = false;
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
toEl.appendChild(placeholderEl);
// Set the height only if not set externally.
let autoHeight = getComputedStyle(placeholderEl).height;
if (!autoHeight || autoHeight === '0px') {
    placeholderEl.style.height = Math.min(activeEl.offsetHeight - 16, 200) + 'px';
}
}

function activatePlaceholder() {
placeholderEl.style.left = activeEl.offsetLeft + 'px';
placeholderEl.style.width = activeEl.offsetWidth + 'px';
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

    fromEl.appendChild(floatEl);
}

// Utils.

function getRelevantMouseEventOrTouchOrExitOnDoubleTouch(event) {
    let isTouch = Boolean(event.touches);
    if (activeEl !== null && isTouch !== touchDrag) {
        // Different pointer than what we started the drag with, ignore.
        return;
    }
    if (isTouch) {
        if (event.touches.length !== 1) {
            exitDrag(false);
        }
        return event.touches.item(0);
    }
    return event;
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

function getItemFromContainerEvent(event) {
    // For now let's just find the element that is directly inside container.
    // We can add a filter for handle on the way if we ever need, check for
    // filter-in and -out classes, but eventually we just want this direct
    // child.
    let containerEl = event.currentTarget;
    let result = null;
    for (let el = event.target; el !== containerEl; el = el.parentElement) {
        if (el.tagName === 'BUTTON') {
            return null;
        }
        result = el;
    }
    // Returns null if the event is directly on the container,
    // or the element was filtered out for any reason.
    if (result && result.classList.contains('card'))
        return result;
    else {
        return null;
    }
}

export default {
    init: initDragContainer,
};
