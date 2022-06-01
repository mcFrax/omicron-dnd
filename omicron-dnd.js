import { animateMoveInsideContainer } from "./animate-move";
import { Anim, animMs, transformsByElem } from "./anims";
import { preventImmediateClick } from "./click-blocker";
import { getItemFromContainerEvent, getItemsInContainerEndIndex, getItemsInContainerStartIndex, hasContainerAncestor } from "./dom-traversal";
import { cancelIfCancellable, cancelIfOmicronActive, toggleListeners } from "./event-utils";
import { expando } from "./expando";
import { DragKind } from "./external-types";
import { ForbiddenIndices } from "./forbidden-indices";
import { containerHoverEntered, containerHoverLeft, getHoverContainersDeeperThan } from "./hover-tracker";
import { insertionIndexFromEventualIndex } from "./index-conversions";
import { cancelInvisible, makeInvisible } from "./invisible-item";
import { ContainerOptions } from "./options";
import { disableOverscrollBehavior, revertOverscrollBehavior } from "./overscroll-behavior";
import { updateActiveScrollers, updateScrollers } from "./scrollers";
import { disableUserSelectOnBody, revertUserSelectOnBody } from "./selection-control";
import { BadStateError, dragState, setDragState, StateEnum } from "./state";
import { updateFloatElOnNextFrame } from "./update-float-el-on-next-frame";
function initDragContainer(container, options) {
    if (container[expando]) {
        return; // Ignore repeated calls.
    }
    const containerEl = Object.assign(container, {
        [expando]: {
            el: container,
            options: Object.assign(new ContainerOptions(), options || {}),
            domDepth: 0, // To be updated dynamically when added to hoverContainers.
        },
    });
    toggleListeners(true, document, [
        ['dragover', cancelIfOmicronActive],
        ['touchmove', cancelIfOmicronActive],
    ]);
    toggleListeners(true, containerEl, [
        ['pointerdown', anyState_container_PointerDown],
        ['pointerenter', anyState_container_PointerEnter],
        ['pointerleave', anyState_container_PointerLeave],
    ]);
    if (options.setWebkitTapHighlightColorTransparent &&
        ('webkitTapHighlightColor' in containerEl.style)) {
        containerEl.style.webkitTapHighlightColor = 'transparent';
    }
    if (getComputedStyle(containerEl).position === 'static') {
        // The container needs to be positioned to work correctly
        // with absolutely positioned placeholder.
        containerEl.style.position = 'relative';
    }
}
function toggleEvents_statePreDrag(toggleOn, touchDrag) {
    if (touchDrag) {
        toggleListeners(toggleOn, document, [
            ['touchstart', statePreDrag_window_TouchStart],
            ['touchmove', statePreDrag_window_TouchMove],
            ['touchend', statePreDrag_window_TouchEndOrCancel],
            ['touchcancel', statePreDrag_window_TouchEndOrCancel],
            ['pointermove', cancelIfCancellable],
        ]);
    }
    else {
        toggleListeners(toggleOn, document, [
            ['pointermove', statePreDrag_window_PointerMove],
            ['pointerup', statePreDrag_window_PointerUpOrCancel],
            ['pointercancel', statePreDrag_window_PointerUpOrCancel],
        ]);
    }
}
function toggleEvents_stateDrag(toggleOn, touchDrag) {
    if (touchDrag) {
        toggleListeners(toggleOn, document, [
            // For preventing multi-touch while dragging.
            ['touchstart', stateDrag_window_TouchStart],
            // We need to capture touchmove events in order to call
            // .preventDefault() on them and stop the scrolling.
            // Calling .preventDefault() on PointerEvents doesn't do that.
            ['touchmove', stateDrag_window_TouchMove],
            ['touchend', stateDrag_window_TouchEnd],
            ['touchcancel', stateDrag_window_TouchCancel],
            ['pointermove', cancelIfCancellable],
        ]);
    }
    else {
        toggleListeners(toggleOn, document, [
            ['pointermove', stateDrag_window_PointerMove],
            ['pointerup', stateDrag_window_PointerUp],
            ['pointercancel', stateDrag_window_PointerCancel],
        ]);
    }
    toggleListeners(toggleOn, document, [
        ['selectstart', cancelIfCancellable],
    ]);
}
function anyState_container_PointerDown(event) {
    // Unconditionally release pointer capture. I do that before any checks
    // for pending drag to avoid unnecessary races with touchstart.
    const containerEl = event.currentTarget;
    if (!hasContainerAncestor(containerEl)) {
        // Only let the event propagate if there are other containers below,
        // but don't let it go outside.
        event.stopPropagation();
    }
    if (dragState) {
        return;
    }
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
        // When using mouse, allow only the main button.
        // event.button on PointerEvent unfortunately doesn't work,
        // but event.buttons does.
        // TODO: We should probably check the button number for
        // pointerType === 'pointer' as well, just not for touch.
        return;
    }
    const touchDrag = (event.pointerType === 'touch');
    const containerData = containerEl[expando];
    const containerOptions = containerData.options;
    if (containerOptions.allowPull === false) {
        // Starting drag in this container is not allowed at all.
        return;
    }
    let dragKind = containerOptions.allowPull;
    const pickedEl = getItemFromContainerEvent(event, containerData.options);
    if (!pickedEl) {
        // TODO: Add an option to .stopPropagation() here as well, to prevent
        // dragging the container by elements, event if not by the handle?
        return;
    }
    // Allow the callback to cancel the preDrag before it starts.
    // This can be used to implement some dynamic barrier on top of
    // draggableSelector, filterSelector, and handleSelector.
    if (typeof containerOptions.onBeforePreDrag === 'function') {
        const ret = containerOptions.onBeforePreDrag(containerEl, pickedEl, event);
        switch (ret) {
            case false:
                // Cancel drag.
                return;
            case DragKind.Move:
            case DragKind.Copy:
                // Override drag kind.
                dragKind = ret;
                break;
            default:
                break;
        }
    }
    // Only stop propagation to ancestor containers after deciding that
    // something was indeed grabbed.
    // That allows the nested container to be dragged by contents when using
    // handle/filter, or just being grabbed by the padding/empty area.
    event.stopPropagation();
    const from = {
        containerEl,
        index: Array.from(containerEl.children).indexOf(pickedEl),
    };
    toggleEvents_statePreDrag(true, touchDrag);
    const initialPickupRect = pickedEl.getClientRects()[0];
    const pickupPointerPos = {
        x: event.clientX,
        y: event.clientY,
    };
    // I add some arbitrary difference to give the effect of the element
    // snapping out of place, instead of just staying in place silently.
    const floatFromPointerOffset = {
        x: initialPickupRect.x - pickupPointerPos.x + 16,
        y: initialPickupRect.y - pickupPointerPos.y - 4,
    };
    // We are entering statePreDrag. We will start the drag after a delay, or if
    // the mouse moves sufficiently far. We will cancel the drag if the touch
    // moves too far before the delay.
    // IMPORTANT: Some logic depends on startDrag being called asynchronously,
    // so even if the delay is 0, setTimeout should still be used.
    const delay = containerOptions.delay;
    const preDragTimeoutId = setTimeout(startDrag, delay);
    if (typeof containerOptions.onPreDragStart === 'function') {
        containerOptions.onPreDragStart(containerEl, pickedEl, event);
    }
    disableUserSelectOnBody();
    // Ensure the element has pointer capture. This happens automatically
    // for touch, but not for mouse.
    // Pointer capture is important to avoid calls to enterContainer
    // and leaveContainer during preDrag - these would mess up the drag
    // setup WRT toEl. The capture will be released afterwards, allowing
    // immediate execution of leaveContainer/enterContainer if necessary.
    const pointerDownTarget = event.target;
    pointerDownTarget.setPointerCapture(event.pointerId);
    setDragState({
        state: StateEnum.PreDrag,
        pointerId: event.pointerId,
        pointerDownTarget,
        touchDrag,
        from,
        dragKind,
        pickedEl,
        initialPickupRect,
        pickupPointerPos,
        floatFromPointerOffset,
        currentPointerPos: pickupPointerPos,
        floatElScale: containerOptions.floatElScale,
        minimalMoveMouse: containerOptions.minimalMoveMouse,
        forbiddenIndices: new ForbiddenIndices(),
        preDragTimeoutId,
    });
}
function startDrag() {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PreDrag)
        throw new BadStateError(StateEnum.PreDrag);
    // In case this was triggered by mouse, and not by the timeout itsef, we
    // cancel the timeout.
    clearTimeout(dragState.preDragTimeoutId);
    let containerData = dragState.from.containerEl[expando];
    const containerOptions = containerData.options;
    if (typeof containerOptions.onBeforeDragStart === 'function') {
        containerOptions.onBeforeDragStart(dragState.from.containerEl, dragState.pickedEl);
    }
    // Should we go over the whole activeEl subtree and mark the containers there
    // as inactive? We may need to, actually.
    toggleEvents_stateDrag(true, dragState.touchDrag);
    toggleEvents_statePreDrag(false, dragState.touchDrag);
    // Release default pointer capture. This is important that it happens only
    // after dragStart, and that we keep the capture during preDrag - that saves
    // us from some subtle race conditions. See issue #11 for context.
    if (dragState.pointerDownTarget) {
        // Pointermove events are by default all captured by the pointerdown's target.
        // That means no pointerenter/pointerleave events, that we rely on, so
        // we need to release the pointer capture.
        // Source: https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
        dragState.pointerDownTarget.releasePointerCapture(dragState.pointerId);
    }
    disableOverscrollBehavior();
    const floatEl = createFloatEl(dragState);
    if (typeof containerOptions.onFloatElementCreated === 'function') {
        containerOptions.onFloatElementCreated(floatEl, dragState.from.containerEl, dragState.pickedEl);
    }
    if (dragState.dragKind === DragKind.Move) {
        makeInvisible(dragState.pickedEl);
        // Schedule animation of moving pickedEl out of the container. In practice,
        // We will almost always override it with another animation of "insertion",
        // but sometimes it may happen that we actually leave the original container
        // immediately.
        animateMoveInsideContainer(dragState.from.containerEl, dragState.from.index, getItemsInContainerEndIndex(dragState.from.containerEl));
    }
    if (typeof containerOptions.onDragStart === 'function') {
        containerOptions.onDragStart(dragState.from.containerEl, dragState.pickedEl);
    }
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(dragState.from.containerEl, dragState.pickedEl);
    }
    if (navigator.vibrate && containerData.options.dragStartVibration) {
        // Unfortunately doesn't work if this drag is the first user interaction
        // with the page. This is due to Chrome being a little bit too strict
        // in requiring previous user interaction with the page before
        // activating Vibration API.
        // See https://stackoverflow.com/a/46189638/2468549.
        navigator.vibrate(containerData.options.dragStartVibration);
    }
    setDragState(Object.assign(Object.assign({}, dragState), { state: StateEnum.PendingDrag, floatEl, floatElPos: {
            x: dragState.currentPointerPos.x + dragState.floatFromPointerOffset.x,
            y: dragState.currentPointerPos.y + dragState.floatFromPointerOffset.y,
        } }));
    // Synthethic update, to determine the insertion point.
    // TODO: We might need to give it a hint that this is a drag start, after all.
    updateOnMove({
        clientX: dragState.currentPointerPos.x,
        clientY: dragState.currentPointerPos.y,
    });
}
function statePreDrag_window_TouchStart(event) {
    if (dragState && event.touches.length !== 1) {
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
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PreDrag)
        throw new BadStateError(StateEnum.PreDrag);
    if (event.pointerId !== dragState.pointerId) {
        return;
    }
    const newX = dragState.currentPointerPos.x = event.clientX;
    const newY = dragState.currentPointerPos.y = event.clientY;
    let xDiff = newX - dragState.pickupPointerPos.x;
    let yDiff = newY - dragState.pickupPointerPos.y;
    let distanceSquaredFromInitial = xDiff * xDiff + yDiff * yDiff;
    const minimalMoveMouse = dragState.minimalMoveMouse;
    if (distanceSquaredFromInitial > minimalMoveMouse * minimalMoveMouse) {
        startDrag();
    }
}
function statePreDrag_window_PointerUpOrCancel(event) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PreDrag)
        throw new BadStateError(StateEnum.PreDrag);
    if (event.pointerId !== dragState.pointerId) {
        return;
    }
    exitDrag(false);
}
function stateDrag_window_TouchStart(event) {
    // We don't allow multi-touch during dragging.
    exitDrag(false);
}
function stateDrag_window_TouchMove(event) {
    if (event.cancelable) {
        // Prevent scroll.
        event.preventDefault();
    }
    const touch = event.touches.item(0);
    if (!touch || event.touches.length !== 1) {
        // We don't allow multi-touch during dragging.
        exitDrag(false);
        return;
    }
    handleMove(touch);
}
function stateDrag_window_PointerMove(event) {
    if (event.pointerId !== (dragState === null || dragState === void 0 ? void 0 : dragState.pointerId)) {
        return;
    }
    handleMove(event);
}
// The direction of the last pointer move in y-coordinates.
// -1 when going up (lower y value), +1 when going down.
// The last value is kept as long as the y-coord doesn't change.
let yDirection = -1;
// This is to be called only when the pointer actually moves.
function handleMove(evtPoint) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    // Update the mouse position.
    if (evtPoint.clientY !== dragState.currentPointerPos.y) {
        yDirection = evtPoint.clientY > dragState.currentPointerPos.y ? 1 : -1;
    }
    dragState.currentPointerPos.x = evtPoint.clientX;
    dragState.currentPointerPos.y = evtPoint.clientY;
    dragState.floatElPos.x =
        dragState.currentPointerPos.x + dragState.floatFromPointerOffset.x;
    dragState.floatElPos.y =
        dragState.currentPointerPos.y + dragState.floatFromPointerOffset.y;
    updateFloatElOnNextFrame();
    updateOnMove(evtPoint);
}
// This is to be called both when pointer moves, and to invoke synthetic update
// after scroll and on drag start.
function updateOnMove(evtPoint) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    // If we are hovering over some containers that are descendants
    // of toEl but we didn't enter them yet for any reason, let's reconsider.
    const toElDomDepth = dragState.to ? dragState.to.containerEl[expando].domDepth : -1;
    for (const hoverContainer of getHoverContainersDeeperThan(toElDomDepth)) {
        if (maybeEnterContainer(hoverContainer, evtPoint)) {
            // enterContainer took take care of handling the new position
            // and animation, so our work here is done.
            return;
        }
    }
    const to = dragState.to;
    if (!to) {
        return;
    }
    updateActiveScrollers();
    let updatedEventualIndex = findUpdatedEventualIndex(to.containerEl, evtPoint);
    let updatedInsertionIndex = insertionIndexFromEventualIndex(to.containerEl, updatedEventualIndex);
    if (updatedEventualIndex != to.insertionIndex && !dragState.forbiddenIndices.isForbiddenIndex(to.containerEl, dragState.pickedEl, updatedInsertionIndex)) {
        let previousEventualIndex = to.eventualIndex;
        to.eventualIndex = updatedEventualIndex;
        to.insertionIndex = updatedInsertionIndex;
        animateMoveInsideContainer(to.containerEl, previousEventualIndex, updatedEventualIndex);
        updatePlaceholderAndNoMoveZone(to);
    }
}
// By default, we optimize the search by going only from the current index
// in the direction of mouseY, and only when the move is outside of
// precomputed zone where we know no move happened. When insertionContainer
// is supplied, we ignore both optimizations.
function findUpdatedEventualIndex(containerEl, evtPoint) {
    var _a, _b, _c, _d, _e, _f;
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    let ignoreCurrentNewIndex = containerEl !== ((_a = dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl);
    // TODO: There is some glitch in how mouseY works after autoscroll.
    // I don't know what the issue is, but there is some shift introduced,
    // perhaps at this place.
    let mouseY = evtPoint.clientY - containerEl.getClientRects()[0].top;
    let insIndexBefore = (_c = (_b = dragState.to) === null || _b === void 0 ? void 0 : _b.eventualIndex) !== null && _c !== void 0 ? _c : 0;
    let updatedNewIndex = insIndexBefore;
    const { yStartNoMoveZone, yEndNoMoveZone } = (_d = dragState.to) !== null && _d !== void 0 ? _d : {
        yStartNoMoveZone: Infinity,
        yEndNoMoveZone: -Infinity,
    };
    const { containerEl: fromEl, index: fromIndex, } = dragState.from;
    const isMove = dragState.dragKind === DragKind.Move;
    // TODO: Extract, deduplicate, cache.
    const activeElHeight = dragState.pickedEl.offsetHeight;
    // Note: placeholderEl may be in a different container, so it's height may
    // be completely broken here. It shouldn't matter, though, as we won't be
    // using it in that case.
    const activeToPlaceholderOffset = dragState.to ? dragState.to.placeholderEl.offsetHeight - activeElHeight : 0;
    const activeToNothingOffset = -activeElHeight - 8;
    const nothingToPlaceholderOffset = (_f = (_e = dragState.to) === null || _e === void 0 ? void 0 : _e.placeholderEl.offsetHeight) !== null && _f !== void 0 ? _f : 0;
    let wiggleZoneSize = 0.5;
    let snapMargin = (1 - wiggleZoneSize) / 2;
    let bottomSnapBorder = yDirection === -1 ? (1 - snapMargin) : snapMargin;
    let startIndex = getItemsInContainerStartIndex(containerEl);
    let endIndex = getItemsInContainerEndIndex(containerEl);
    if (ignoreCurrentNewIndex || (mouseY < yStartNoMoveZone && updatedNewIndex !== 0)) {
        // Correct for the fact that if we dragged the element down from
        // its place, some elements above it are shifted from their
        // offset position.
        let offsetCorrection = containerEl === dragState.from.containerEl && isMove ? activeToNothingOffset : 0;
        updatedNewIndex = startIndex;
        // We may look up one extra element at the start, but that is not an issue.
        let iterationStart = endIndex - 1;
        if (!ignoreCurrentNewIndex && insIndexBefore < iterationStart) {
            iterationStart = insIndexBefore;
        }
        for (let i = iterationStart; i >= startIndex; --i) {
            let otherEl = containerEl.children[i];
            if (otherEl === dragState.pickedEl && isMove)
                continue;
            if (i < fromIndex) {
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
                if (containerEl === fromEl && isMove && i > fromIndex) {
                    // Special new case. otherEl will be moved up
                    // and end up with index i-1, so inserting after
                    // it means we will end up with index i.
                    updatedNewIndex = i;
                }
                else {
                    updatedNewIndex = i + 1;
                }
                break;
            }
        }
    }
    else if (mouseY > yEndNoMoveZone) {
        let offsetCorrection = nothingToPlaceholderOffset;
        // Set to the highest possible value - in case we are at the very
        // bottom of the container.
        updatedNewIndex = (containerEl === fromEl && isMove) ? endIndex - 1 : endIndex;
        // We may look up one extra element at the start, but that is not an issue.
        for (let i = insIndexBefore; i < endIndex; ++i) {
            let otherEl = containerEl.children[i];
            if (otherEl === dragState.pickedEl && isMove)
                continue; // May still happen.
            if (i > fromIndex && containerEl === fromEl && isMove) {
                offsetCorrection = activeToPlaceholderOffset;
            }
            if (getComputedStyle(otherEl).display === 'none') {
                continue;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY < otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl before otherEl.
                if (containerEl === fromEl && isMove && i > fromIndex) {
                    // Special new case. otherEl won't be bumped to i+1
                    // but instead back to i-th position when we
                    // re-insert activeEl, so the inserting splice
                    // will be at position i-1, not i.
                    updatedNewIndex = i - 1;
                }
                else {
                    updatedNewIndex = i;
                }
                break;
            }
        }
    }
    return updatedNewIndex;
}
function updatePlaceholderAndNoMoveZone(to) {
    let newPlaceholderTop = findPlaceholderTop(to);
    // TODO: Extract, deduplicate, cache, correct margins.
    const nothingToPlaceholderOffset = to.placeholderEl.offsetHeight;
    to.yStartNoMoveZone = newPlaceholderTop - 8;
    to.yEndNoMoveZone = newPlaceholderTop - nothingToPlaceholderOffset;
    to.placeholderEl.style.transform = `translateY(${newPlaceholderTop}px)`;
}
function findPlaceholderTop({ containerEl: toEl, eventualIndex, }) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    const { containerEl: fromEl, index: oldIndex, } = dragState.from;
    const isMove = dragState.dragKind === DragKind.Move;
    // TODO: Extract, deduplicate, cache.
    const activeElHeight = dragState.pickedEl.offsetHeight;
    const activeToNothingOffset = -activeElHeight - 8;
    let startIndex = getItemsInContainerStartIndex(toEl);
    let endIndex = getItemsInContainerEndIndex(toEl);
    let ref, offsetCorrection;
    if (endIndex === startIndex) {
        // We don't have any reference, it will just be at the top.
        // However, the offsetCorrection should probably account for
        // margin/padding.
        ref = null;
        offsetCorrection = 0;
    }
    else if (toEl === fromEl && isMove && eventualIndex === endIndex - 1) {
        // Last element in fromEl.
        ref = toEl.children[endIndex - 1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8 + activeToNothingOffset;
    }
    else if ((toEl !== fromEl || !isMove) && eventualIndex === endIndex) {
        // Last element, not in fromEl.
        ref = toEl.children[endIndex - 1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8;
    }
    else if (toEl === fromEl && isMove && eventualIndex > oldIndex) {
        ref = toEl.children[eventualIndex + 1];
        offsetCorrection = activeToNothingOffset;
    }
    else {
        ref = toEl.children[eventualIndex];
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
function stateDrag_window_TouchCancel(event) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_TouchEnd(event) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    dragEndedWithRelease();
    event.preventDefault();
    event.stopPropagation();
}
function stateDrag_window_PointerCancel(event) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_PointerUp(event) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    if (event.pointerId !== dragState.pointerId) {
        // Not relevant.
        return;
    }
    dragEndedWithRelease();
}
function dragEndedWithRelease() {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    // We can't really prevent the browser for generating a click, but we
    // can capture it. The click will, however, not necessaily generate
    // (only when there was an element that browser thinks was clicked), so
    // we limit blocking to immediately generated events.
    preventImmediateClick();
    // End drag successfully, except when we aren't actually in any container.
    // TODO: Should we have a special handling for touchcancel? OTOH, I don't
    // see it showing up in practice. Maybe except when touch becomes a scroll,
    // but we eliminate that instance.
    exitDrag(Boolean(dragState.to));
}
function exitDrag(execSort) {
    var _a;
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PreDrag &&
        (dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag) {
        throw new Error(`exitDrag called in wrong state: ${dragState === null || dragState === void 0 ? void 0 : dragState.state}`);
    }
    if (execSort && !(dragState.state === StateEnum.PendingDrag && dragState.to)) {
        console.error('Exit drag called with execSort==true, but conditions are not met.');
        execSort = false;
    }
    if (dragState.state == StateEnum.PendingDrag) {
        dragState.floatEl.remove(); // Removing this element now saves some special casing.
        if (dragState.to) {
            dragState.to.placeholderEl.remove();
        }
    }
    else {
        clearTimeout(dragState.preDragTimeoutId);
    }
    let insertEl = null;
    let dragEndEvent;
    // Note: toEl is implied by execSort, but Typescript doesn't know that.
    if (execSort &&
        dragState.state === StateEnum.PendingDrag &&
        dragState.to &&
        (dragState.to.containerEl !== dragState.from.containerEl ||
            dragState.to.eventualIndex !== dragState.from.index)) {
        insertEl = (dragState.dragKind === DragKind.Move) ? dragState.pickedEl : dragState.pickedEl.cloneNode(true);
        dragEndEvent = {
            dragExecuted: true,
            item: dragState.pickedEl,
            from: dragState.from.containerEl,
            fromIndex: dragState.from.index,
            oldIndex: dragState.from.index,
            to: dragState.to.containerEl,
            eventualIndex: dragState.to.eventualIndex,
            insertionIndex: dragState.to.insertionIndex,
            newIndex: dragState.to.eventualIndex,
        };
        // Note:
        // We need to adjust the position of elements with transform
        // to avoid shifting them around suddenly. It would be nice
        // to do that in one go for each element, but that would involve
        // several cases and so on. I'll just do that as I go, and not
        // worry that I do that twice for some elements most of the time.
        if (dragState.dragKind === DragKind.Move) {
            dragState.pickedEl.remove();
        }
        const { containerEl: fromEl, index: fromIndex, } = dragState.from;
        const { containerEl: toEl, eventualIndex, } = dragState.to;
        // TODO: Extract, deduplicate, cache.
        const activeElHeight = dragState.pickedEl.offsetHeight;
        const activeToNothingOffset = -activeElHeight - 8;
        // Adjust elements after removed and animate them to 0.
        for (let elem of Array.from(fromEl.children).slice(fromIndex)) {
            let currentTransform = (transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] -= activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                transformsByElem.set(elem, currentTransform);
            }
            Anim.start(fromEl, [elem], 0, animMs, currentTransform[1]);
        }
        // Remove placeholder.
        dragState.to.placeholderEl.remove();
        // We removed pickedEl before, so now we insert simply at eventualIndex.
        if (eventualIndex === toEl.children.length) {
            toEl.appendChild(insertEl);
        }
        else {
            toEl.children[eventualIndex].before(insertEl);
        }
        // Adjust elements after inserted and animate them to 0.
        for (let elem of Array.from(toEl.children).slice(eventualIndex + 1)) {
            let currentTransform = (transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] += activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                transformsByElem.set(elem, currentTransform);
            }
            Anim.start(fromEl, [elem], 0, animMs, currentTransform[1]);
        }
    }
    else {
        dragEndEvent = {
            dragExecuted: false,
            item: dragState.pickedEl,
            from: dragState.from.containerEl,
            fromIndex: dragState.from.index,
            oldIndex: dragState.from.index,
        };
        // When cancelling, let's simply tell everyone to go home.
        for (let cont of [dragState.from.containerEl, (_a = dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl]) {
            if (cont) { // toEl may be missing.
                Anim.start(cont, Array.from(cont.children), 0, animMs);
            }
        }
    }
    cancelInvisible(dragState.pickedEl);
    if (dragState.state == StateEnum.PendingDrag) {
        let animElem = insertEl !== null && insertEl !== void 0 ? insertEl : dragState.pickedEl;
        // Our Anim handles only y animation for now, we should fix that.
        // However, let's at least handle the y.
        let destRect = animElem.getClientRects()[0];
        Anim.start(animElem, [animElem], 0, animMs, dragState.floatElPos.y - destRect.top);
        if (dragState.to) {
            removeBottomPaddingCorrection(dragState.to.containerEl);
            // Invoke onContainerLeft here to be consistent with how it's called
            // in leaveContainer - after the container cleanup.
            const toContainerOptions = dragState.to.containerEl[expando].options;
            if (typeof toContainerOptions.onContainerLeft === 'function') {
                toContainerOptions.onContainerLeft(dragState.to.containerEl, dragState.pickedEl);
            }
        }
    }
    toggleEvents_statePreDrag(false, dragState.touchDrag);
    toggleEvents_stateDrag(false, dragState.touchDrag);
    revertOverscrollBehavior();
    revertUserSelectOnBody();
    setDragState(null);
    // Finally, let call all the drag-end events.
    // All the callbacks get the same event object.
    const fromContainerOptions = dragEndEvent.from[expando].options;
    if (dragEndEvent.dragExecuted) {
        if (dragEndEvent.to === dragEndEvent.from) {
            if (typeof fromContainerOptions.onInternalChange === 'function') {
                fromContainerOptions.onInternalChange(dragEndEvent);
            }
        }
        else {
            if (typeof fromContainerOptions.onDropToOtherContainer === 'function') {
                fromContainerOptions.onDropToOtherContainer(dragEndEvent);
            }
            const toContainerOptions = dragEndEvent.to[expando].options;
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
    var _a;
    const containerEl = event.currentTarget;
    const containerData = containerEl[expando];
    containerHoverEntered(containerData);
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag) {
        // Not dragging anything, so nothing to do.
        return;
    }
    if (containerEl === ((_a = dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
        // Already in this container, nothing to do.
        return;
    }
    maybeEnterContainer(containerData, event);
}
function anyState_container_PointerLeave(event) {
    var _a;
    const containerEl = event.currentTarget;
    const containerData = containerEl[expando];
    containerHoverLeft(containerData);
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag ||
        containerEl !== ((_a = dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
        return; // Not relevant.
    }
    // PointerLeave event might have been caused by releasing the touch or
    // button, however, we can't really tell. event.buttons === 0 works in
    // most browsers, but not iOS Safari (at least not in 14).
    // We will instead wait for other related events to dispatch. In case
    // this is the pointerup case, the drag will be over by the time the timer
    // executes.
    setTimeout(() => {
        var _a;
        // Make sure that the drag is still pending and we didn't move
        // to another container. In issue #8 we were hitting toEl === null here,
        // apparently because several timeouts from several left containers
        // got clamped together.
        if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) === StateEnum.PendingDrag &&
            containerEl === ((_a = dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
            leaveContainer();
            // mousemove handler will figure the container to enter.
            // TODO: if it gets glitchy, call the mousemove handler here directly.
        }
    }, 0);
}
function maybeEnterContainer(containerData, evPlace) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    let cData = containerData;
    let rect = cData.el.getClientRects()[0];
    if (!cData.options.allowDrop || !rect) {
        return false;
    }
    const xLast = dragState.currentPointerPos.x;
    if (xLast >= rect.left + rect.width * cData.options.enterGuardLeft + cData.options.enterGuardLeftPx &&
        xLast <= rect.right - rect.width * cData.options.enterGuardRight - cData.options.enterGuardRightPx) {
        const eventualIndex = findUpdatedEventualIndex(cData.el, evPlace);
        const insertionIndex = insertionIndexFromEventualIndex(cData.el, eventualIndex);
        if (!dragState.forbiddenIndices.isForbiddenIndex(cData.el, dragState.pickedEl, insertionIndex)) {
            enterContainer(cData.el, insertionIndex, eventualIndex);
            return true;
        }
    }
    return false;
}
function enterContainer(toEl, insertionIndex, eventualIndex) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    if (dragState.to) {
        // Handle removal from the previous container.
        leaveContainer();
    }
    // Then handle insertion into the new container.
    updateScrollers(toEl);
    dragState.to = {
        containerEl: toEl,
        insertionIndex,
        eventualIndex,
        placeholderEl: createPlaceholder(toEl),
        yStartNoMoveZone: 0,
        yEndNoMoveZone: 0,
    };
    addBottomPaddingCorrection();
    updatePlaceholderAndNoMoveZone(dragState.to);
    dragState.to.placeholderEl.style.visibility = 'visible';
    animateMoveInsideContainer(toEl, getItemsInContainerEndIndex(toEl), eventualIndex);
    const containerOptions = toEl[expando].options;
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(dragState.from.containerEl, dragState.pickedEl);
    }
}
function leaveContainer() {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    if (!dragState.to) {
        return;
    }
    const leftContainerEl = dragState.to.containerEl;
    animateMoveInsideContainer(leftContainerEl, dragState.to.eventualIndex, getItemsInContainerEndIndex(leftContainerEl));
    removeBottomPaddingCorrection(leftContainerEl);
    dragState.to = undefined;
    const containerOptions = leftContainerEl[expando].options;
    if (typeof containerOptions.onContainerLeft === 'function') {
        containerOptions.onContainerLeft(leftContainerEl, dragState.pickedEl);
    }
}
function createPlaceholder(toEl) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    const placeholderEl = document.createElement('div');
    placeholderEl.style.position = 'absolute';
    placeholderEl.style.top = '0';
    placeholderEl.style.zIndex = '1';
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
        placeholderEl.style.height = Math.min(dragState.pickedEl.offsetHeight - 16, 200) + 'px';
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
function addBottomPaddingCorrection() {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    if (dragState.to && dragState.to.containerEl !== dragState.from.containerEl) {
        const toEl = dragState.to.containerEl;
        const nothingToPlaceholderOffset = dragState.to.placeholderEl.offsetHeight;
        toEl.style.paddingBottom =
            parseFloat(getComputedStyle(toEl).paddingBottom.slice(0, -2)) + nothingToPlaceholderOffset + 'px';
    }
}
function removeBottomPaddingCorrection(toEl) {
    if ((dragState === null || dragState === void 0 ? void 0 : dragState.state) !== StateEnum.PendingDrag)
        throw new BadStateError(StateEnum.PendingDrag);
    if (toEl !== dragState.from.containerEl) {
        toEl.style.paddingBottom = '';
    }
}
function createFloatEl(dragState) {
    const pickedEl = dragState.pickedEl;
    const floatEl = pickedEl.cloneNode(true);
    floatEl.style.position = 'fixed';
    floatEl.style.left = '0';
    floatEl.style.top = '0';
    floatEl.style.margin = '0';
    floatEl.style.zIndex = '10000000';
    floatEl.style.pointerEvents = 'none';
    floatEl.style.width = getComputedStyle(pickedEl).width;
    floatEl.style.height = getComputedStyle(pickedEl).height;
    const tOrigX = -dragState.floatFromPointerOffset.x;
    const tOrigY = -dragState.floatFromPointerOffset.y;
    floatEl.style.transformOrigin = `${tOrigX}px ${tOrigY}px`;
    const posX = dragState.currentPointerPos.x + dragState.floatFromPointerOffset.x;
    const posY = dragState.currentPointerPos.y + dragState.floatFromPointerOffset.y;
    floatEl.style.transform = `translate(${posX}px,${posY}px) scale(${dragState.floatElScale})`;
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
    return floatEl;
}
export default {
    init: initDragContainer,
    DragKind,
};
