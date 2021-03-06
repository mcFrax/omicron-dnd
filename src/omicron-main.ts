
import { animateMoveInsideContainer } from "./animate-move";
import { setTransform } from "./anims";
import { EvPlace, InsertionPlaceCandidate } from "./base-types";
import { preventImmediateClick } from "./click-blocker";
import { getItemFromContainerEvent, getItemsInContainerEndIndex, getItemsInContainerStartIndex, hasContainerAncestor, isOrderable } from "./dom-traversal";
import { cancelIfCancellable, cancelIfOmicronActive, toggleListeners, TypedActiveEvent } from "./event-utils";
import { ContainerData, ContainerEl, expando } from "./expando";
import { DragEndEvent, DragKind } from "./external-types";
import { ForbiddenIndices } from "./forbidden-indices";
import { containerHoverEntered, containerHoverLeft, getHoverContainersDeeperThan } from "./hover-tracker";
import { eventualIndexFromInsertionIndex } from "./index-conversions";
import { cancelInvisible, makeInvisible } from "./invisible-item";
import { getEffectiveMarginBetweenSiblings, getGapBetweenSiblingsAfterItemRemoval, getGapToPlaceholderOffset, getItemToNothingOffset } from "./offsets";
import { getComputedStyleOr0 } from './style-basics';
import { ContainerOptions } from "./options";
import { disableOverscrollBehavior, revertOverscrollBehavior } from "./overscroll-behavior";
import { clearPlaceholders, getOrCreatePlaceholder, hidePlaceholder, showPlaceholder } from "./placeholders";
import { updateActiveScrollers, updateScrollers } from "./scrollers";
import { disableUserSelectOnBody, revertUserSelectOnBody } from "./selection-control";
import { BadStateError, dragState, PreDragState, setDragState, StateEnum } from "./state";
import { updateFloatElOnNextFrame } from "./update-float-el-on-next-frame";
export type {
    BaseDragEndEvent,
    FailedDragEndEvent,
    SuccessfulDragEndEvent,
    DragEndEvent,
} from "./external-types";

declare global {
    interface Node {
        cloneNode<T extends Node>(this: T, deep?: boolean | undefined): T;
    }
    interface CSSStyleDeclaration {
        webkitTapHighlightColor: string;
    }
}

function init(container: HTMLElement, options?: Partial<ContainerOptions>) {
    if (container[expando]) {
        return;  // Ignore repeated calls.
    }
    const containerEl: ContainerEl = Object.assign(container, {
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
    if (containerEl[expando].options.setWebkitTapHighlightColorTransparent &&
            ('webkitTapHighlightColor' in containerEl.style)) {
        containerEl.style.webkitTapHighlightColor = 'transparent';
    }
    if (getComputedStyle(containerEl).position === 'static') {
        // The container needs to be positioned to work correctly
        // with absolutely positioned placeholder.
        containerEl.style.position = 'relative';
    }
}
function toggleEvents_statePreDrag(toggleOn: boolean, touchDrag: boolean) {
    if (touchDrag) {
        toggleListeners(toggleOn, document, [
            ['touchstart', statePreDrag_window_TouchStart],
            ['touchmove', statePreDrag_window_TouchMove],
            ['touchend', statePreDrag_window_TouchEndOrCancel],
            ['touchcancel', statePreDrag_window_TouchEndOrCancel],
            ['pointermove', cancelIfCancellable],
        ]);
    } else {
        toggleListeners(toggleOn, document, [
            ['pointermove', statePreDrag_window_PointerMove],
            ['pointerup', statePreDrag_window_PointerUpOrCancel],
            ['pointercancel', statePreDrag_window_PointerUpOrCancel],
        ]);
    }
}
function toggleEvents_stateDrag(toggleOn: boolean, touchDrag: boolean) {
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
    } else {
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
function anyState_container_PointerDown(event: TypedActiveEvent<PointerEvent, ContainerEl>) {
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

    const pickedElToNothingOffset = getItemToNothingOffset(pickedEl);
    const pickedElToGapOffset =
        pickedElToNothingOffset + getGapBetweenSiblingsAfterItemRemoval(pickedEl);

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
        pickedElToNothingOffset,
        pickedElToGapOffset,
        initialPickupRect,
        pickupPointerPos,
        floatFromPointerOffset,
        currentPointerPos: pickupPointerPos,
        floatElScale: containerOptions.floatElScale,
        minimalMoveMouse: containerOptions.minimalMoveMouse,
        forbiddenIndices: new ForbiddenIndices(),
        preDragTimeoutId,
        recentSnapScrollActivations: new Map(),
    });
}
function startDrag() {
    if (dragState?.state !== StateEnum.PreDrag) throw new BadStateError(StateEnum.PreDrag);
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
        animateMoveInsideContainer(
            dragState.from.containerEl,
            dragState.from.index,
            getItemsInContainerEndIndex(dragState.from.containerEl),
        );
    }

    if (typeof containerOptions.onDragStart === 'function') {
        containerOptions.onDragStart(dragState.from.containerEl, dragState.pickedEl);
    }

    if (navigator.vibrate && containerData.options.dragStartVibration) {
        // Unfortunately doesn't work if this drag is the first user interaction
        // with the page. This is due to Chrome being a little bit too strict
        // in requiring previous user interaction with the page before
        // activating Vibration API.
        // See https://stackoverflow.com/a/46189638/2468549.
        navigator.vibrate(containerData.options.dragStartVibration);
    }

    setDragState({
        ...dragState,
        state: StateEnum.PendingDrag,
        floatEl,
        floatElPos: {
            x: dragState.currentPointerPos.x + dragState.floatFromPointerOffset.x,
            y: dragState.currentPointerPos.y + dragState.floatFromPointerOffset.y,
        },
    });

    const startEvPoint = {
        clientX: dragState.currentPointerPos.x,
        clientY: dragState.currentPointerPos.y,
    };

    if (!containerData.options.keepPositionOnDragStart || !maybeEnterContainer(
                containerData,
                startEvPoint,
                true,
                dragState.from.index,
                dragState.dragKind === DragKind.Move,
            )
    ) {
        // Synthethic update, to determine the insertion point.
        updateOnMove(startEvPoint);
    }

    startPlaceholderUpdates();
}
function statePreDrag_window_TouchStart(event: TypedActiveEvent<TouchEvent, Document>) {
    if (dragState && event.touches.length !== 1) {
        // We don't allow multi-touch during drag.
        exitDrag(false);
    }
}
function statePreDrag_window_TouchMove(event: TypedActiveEvent<TouchEvent, Document>) {
    // We may not be able to cancel the scroll any more after this event,
    // so we have to give up the drag.
    exitDrag(false);
}
function statePreDrag_window_TouchEndOrCancel(event: TypedActiveEvent<TouchEvent, Document>) {
    exitDrag(false);
    // This is pre-drag and no move happened, so we allow the click,
    // hence no preventDefault() call here.
}
function statePreDrag_window_PointerMove(event: TypedActiveEvent<PointerEvent, Document>) {
    if (dragState?.state !== StateEnum.PreDrag) throw new BadStateError(StateEnum.PreDrag);
    if (event.pointerId !== dragState.pointerId) {
        return;
    }

    const newX = dragState.currentPointerPos.x = event.clientX;
    const newY = dragState.currentPointerPos.y = event.clientY;
    let xDiff = newX - dragState.pickupPointerPos.x;
    let yDiff = newY - dragState.pickupPointerPos.y;

    let distanceSquaredFromInitial = xDiff * xDiff + yDiff * yDiff;
    const minimalMoveMouse = dragState.minimalMoveMouse;
    if (distanceSquaredFromInitial >  minimalMoveMouse * minimalMoveMouse) {
        startDrag();
    }
}
function statePreDrag_window_PointerUpOrCancel(event: TypedActiveEvent<PointerEvent, Document>) {
    if (dragState?.state !== StateEnum.PreDrag) throw new BadStateError(StateEnum.PreDrag);
    if (event.pointerId !== dragState.pointerId) {
        return;
    }
    exitDrag(false);
}
function stateDrag_window_TouchStart(event: TypedActiveEvent<TouchEvent, Document>) {
    // We don't allow multi-touch during dragging.
    exitDrag(false);
}
function stateDrag_window_TouchMove(event: TypedActiveEvent<TouchEvent, Document>) {
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
function stateDrag_window_PointerMove(event: TypedActiveEvent<PointerEvent, Document>) {
    if (event.pointerId !== dragState?.pointerId) {
        return;
    }

    handleMove(event);
}

// The direction of the last pointer move in y-coordinates.
// -1 when going up (lower y value), +1 when going down.
// The last value is kept as long as the y-coord doesn't change.
let yDirection = -1;

// This is to be called only when the pointer actually moves.
function handleMove(evtPoint: EvPlace) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
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

type ContainerEnterHint = {
    containerEl: ContainerEl,
    insertionIndex: number,
    ignoreGuards?: boolean,
};

// This is to be called both when pointer moves, and to invoke synthetic update
// after scroll and on drag start.
function updateOnMove(evtPoint: EvPlace) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
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

    const pointedInsertionIndex = findInsertionIndexAtPoint(to.containerEl, evtPoint);

    // The pointer might be pointing at a forbidden index now, but perhaps
    // there is an allowed index on the way from current insertion and
    // the pointed one - in this case, we should move the insertion as
    // far towards the pointer as allowed.
    const updatedInsertionIndex =
        dragState.forbiddenIndices.furthestAllowedInsertionIndex(to.containerEl, dragState.pickedEl, to.insertionIndex, pointedInsertionIndex);

    const updatedEventualIndex = eventualIndexFromInsertionIndex(to.containerEl, updatedInsertionIndex);

    if (updatedEventualIndex === to.eventualIndex) {
        return; // Nothing changes.
    }

    let previousEventualIndex = to.eventualIndex;
    to.eventualIndex = updatedEventualIndex;
    to.insertionIndex = updatedInsertionIndex;

    const previousGapToPlaceholderOffset = to.gapToPlaceholderOffset;
    updatePlaceholder(to, true);
    updateBottomPaddingCorrection();

    animateMoveInsideContainer(
        to.containerEl,
        previousEventualIndex,
        updatedEventualIndex,
        to.gapToPlaceholderOffset !== previousGapToPlaceholderOffset,
    );
}

function findInsertionIndexAtPoint(containerEl: ContainerEl, evtPoint: EvPlace): number {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);

    // TODO: There is some glitch in how mouseY works after autoscroll.
    // I don't know what the issue is, but there is some shift introduced,
    // perhaps at this place.
    let mouseY = evtPoint.clientY - containerEl.getClientRects()[0].top;

    const {
        containerEl: fromEl,
        index: fromIndex,
    } = dragState.from;
    const isMove = dragState.dragKind === DragKind.Move;

    let offsetCorrection = 0;

    let startIndex = getItemsInContainerStartIndex(containerEl);
    let endIndex = getItemsInContainerEndIndex(containerEl);

    for (let insertionIndexCandidate = startIndex;
            insertionIndexCandidate < endIndex;
            ++insertionIndexCandidate) {
        const ref = containerEl.children[insertionIndexCandidate];
        if (!isOrderable(ref)) {
            continue;
        }
        if (!(ref instanceof HTMLElement)) {
            continue;
        }
        let eventualIndexCandidate = insertionIndexCandidate;
        if (isMove && containerEl === fromEl) {
            if (insertionIndexCandidate === fromIndex) {
                continue;
            }
            if (insertionIndexCandidate > fromIndex) {
                offsetCorrection = dragState.pickedElToGapOffset;
                eventualIndexCandidate -= 1;
            }
        }

        const gapToPlaceholderOffset = getGapToPlaceholderOffset({
            containerEl,
            insertionIndex: insertionIndexCandidate,
            eventualIndex: eventualIndexFromInsertionIndex(containerEl, insertionIndexCandidate),
            placeholderEl: getOrCreatePlaceholder(containerEl),
            gapToPlaceholderOffset: 0, // placeholder value
        });

        const correctedRefTop = ref.offsetTop + offsetCorrection;
        // TODO: Using gapToPlaceholderOffset directly here is imprecise.
        const minimalCatchZoneEnd = correctedRefTop + Math.min(ref.offsetHeight, gapToPlaceholderOffset);
        const maximalCatchZoneEnd = correctedRefTop + ref.offsetHeight;
        const catchZoneEnd = (minimalCatchZoneEnd + maximalCatchZoneEnd) / 2;

        if (mouseY <= catchZoneEnd) {
            return insertionIndexCandidate;
        }
    }

    return endIndex;
}

let placeholderUpdateAnimationFrameRequestId = 0;

function startPlaceholderUpdates() {
    if (placeholderUpdateAnimationFrameRequestId === 0) {
        placeholderUpdateAnimationFrameRequestId =
                requestAnimationFrame(placeholderUpdateAnimationFrame);
    }
}

function placeholderUpdateAnimationFrame() {
    if (dragState?.state === StateEnum.PendingDrag) {
        placeholderUpdateAnimationFrameRequestId =
                requestAnimationFrame(placeholderUpdateAnimationFrame);
    } else {
        placeholderUpdateAnimationFrameRequestId = 0;
    }
    if (dragState?.state === StateEnum.PendingDrag && dragState.to) {
        updatePlaceholder(dragState.to, false);
    }
}

function updatePlaceholder(
    to: InsertionPlaceCandidate,
    animateInNewPlace: boolean,
): void {
    let newPlaceholderTop = findPlaceholderTop(to);
    to.gapToPlaceholderOffset = getGapToPlaceholderOffset(to);

    // The margin is applied with absolute position anyway, so we need to
    // subtract it when computing the transform.
    setTransform(to.placeholderEl, 'translateY', newPlaceholderTop - getComputedStyleOr0(to.placeholderEl, 'marginTop'));
    if (animateInNewPlace) {
        setTransform(to.placeholderEl, 'scaleY', 0, 'base');
        setTransform(to.placeholderEl, 'opacity', 0, 'base');
    }
}

function findPlaceholderTop({
    containerEl: toEl,
    eventualIndex,
    insertionIndex,
    placeholderEl,
}: InsertionPlaceCandidate): number {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    const isMove = dragState.dragKind === DragKind.Move;

    let ref: Element | null = null;
    for (ref = toEl.children[insertionIndex-1];
            ref && (ref === dragState.pickedEl && isMove || !isOrderable(ref));
            ref = ref.previousElementSibling);

    if (!ref) {
        // Adding as the first element.
        return getComputedStyleOr0(toEl, 'paddingTop') + getComputedStyleOr0(placeholderEl, 'marginTop');
    }

    // Position the placeholder _after_ the ref.
    const margin = getEffectiveMarginBetweenSiblings(ref, placeholderEl);

    const offsetCorrection =
            (eventualIndex !== insertionIndex && eventualIndex > dragState.from.index) ?
                    dragState.pickedElToGapOffset : 0;

    const ref2 = ref as HTMLElement;
    return ref2.offsetTop + ref2.offsetHeight + margin + offsetCorrection;
}

function stateDrag_window_TouchCancel(event: TypedActiveEvent<TouchEvent, Document>) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_TouchEnd(event: TypedActiveEvent<TouchEvent, Document>) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    dragEndedWithRelease();
    event.preventDefault();
    event.stopPropagation();
}
function stateDrag_window_PointerCancel(event: TypedActiveEvent<PointerEvent, Document>) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_PointerUp(event: TypedActiveEvent<PointerEvent, Document>) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    if (event.pointerId !== dragState.pointerId) {
        // Not relevant.
        return;
    }
    dragEndedWithRelease();
}

function dragEndedWithRelease() {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
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

function exitDrag(execSort: boolean) {
    if (dragState?.state !== StateEnum.PreDrag &&
            dragState?.state !== StateEnum.PendingDrag) {
        throw new Error(`exitDrag called in wrong state: ${dragState?.state}`);
    }
    if (execSort && !(dragState.state === StateEnum.PendingDrag && dragState.to)) {
        console.error('Exit drag called with execSort==true, but conditions are not met.')
        execSort = false;
    }
    if (dragState.state == StateEnum.PendingDrag) {
        dragState.floatEl.remove();  // Removing this element now saves some special casing.
    } else {
        clearTimeout(dragState.preDragTimeoutId);
    }
    clearPlaceholders();

    let insertEl: HTMLElement | null = null;
    let dragEndEvent: DragEndEvent | null;

    // Note: toEl is implied by execSort, but Typescript doesn't know that.
    if (execSort &&
            dragState.state === StateEnum.PendingDrag &&
            dragState.to &&
            (dragState.dragKind !== DragKind.Move ||
                dragState.to.containerEl !== dragState.from.containerEl ||
                dragState.to.eventualIndex !== dragState.from.index)
    ) {
        insertEl = (dragState.dragKind === DragKind.Move) ? dragState.pickedEl : dragState.pickedEl.cloneNode(true);
        dragEndEvent = {
            dragExecuted: true,
            item: dragState.pickedEl,  // TODO: handle move differently.
            from: dragState.from.containerEl,
            fromIndex: dragState.from.index,
            oldIndex: dragState.from.index,
            to: dragState.to.containerEl,
            eventualIndex: dragState.to.eventualIndex,
            insertionIndex: dragState.to.insertionIndex,
            newIndex: dragState.to.eventualIndex,
        };

        if (dragState.dragKind === DragKind.Move) {
            dragState.pickedEl.remove();
        }

        // Remove placeholder.
        dragState.to.placeholderEl.remove();

        const {
            containerEl: fromEl,
            index: fromIndex,
        } = dragState.from;
        const {
            containerEl: toEl,
            eventualIndex,
        } = dragState.to;

        const pickedElToGapOffset = dragState.pickedElToGapOffset;

        // Note:
        // We need to adjust the position of elements with transform
        // to avoid shifting them around suddenly. It would be nice
        // to do that in one go for each element, but that would involve
        // several cases and so on. I'll just do that as I go, and not
        // worry that I do that twice for some elements most of the time.

        if (dragState.dragKind === DragKind.Move) {
            const immediateTranslation = (currentY: number) => currentY - pickedElToGapOffset;
            // Adjust elements after removed and animate them to 0.
            // We assume that they're offset position was changed by
            // pickedElToGapOffset, so we immediately subtract that from
            // their translation.
            const animTimeMs = fromEl[expando].options.animationTimeMs;
            for (let elem of Array.from(fromEl.children).slice(fromIndex)) {
                if (elem instanceof HTMLElement) {
                    setTransform(elem, 'translateY', immediateTranslation, 0, animTimeMs);
                }
            }
        }

        // We removed pickedEl before, so now we insert simply at eventualIndex.
        if (eventualIndex >= toEl.children.length) {
            toEl.appendChild(insertEl);
        } else {
            toEl.children[eventualIndex].before(insertEl);
        }

        // TODO: Genericly handle pickedEl size change after insertion.
        // As here we actually performed the insertion ourselves, we can simply
        // recompute pickedElToGapOffset. This may not be available in the
        // future, if we add option to let the user handle the move manually.
        // OTOH, we can still offer something like moving the item, taking
        // measurement, moving it back (or moving in a clone and then deleting
        // it) so that we can animate floatEl accordingly.
        const pickedElToGapOffset2 =
                getItemToNothingOffset(insertEl) +
                    getGapBetweenSiblingsAfterItemRemoval(insertEl);
        const immediateTranslation2 = (currentY: number) => currentY + pickedElToGapOffset2;
        // Adjust elements after inserted and animate them to 0.
        const animTimeMs = toEl[expando].options.animationTimeMs;
        for (let elem of Array.from(toEl.children).slice(eventualIndex + 1)) {
            if (elem instanceof HTMLElement) {
                setTransform(elem, 'translateY', immediateTranslation2, 0, animTimeMs);
            }
        }
    } else {
        dragEndEvent = {
            dragExecuted: false,
            item: dragState.pickedEl,  // TODO: handle move differently.
            from: dragState.from.containerEl,
            fromIndex: dragState.from.index,
            oldIndex: dragState.from.index,
        };

        // When cancelling, let's simply tell everyone to go home.
        for (let cont of [dragState.from.containerEl, dragState.to?.containerEl]) {
            if (!cont) continue;  // toEl may be missing.
            const animTimeMs = cont[expando].options.animationTimeMs;
            for (const elem of cont.children) {
                if (elem instanceof HTMLElement) {
                    setTransform(elem, 'translateY', 'current', 0, animTimeMs);
                }
            }
        }
    }

    cancelInvisible(dragState.pickedEl);

    if (dragState.state == StateEnum.PendingDrag) {
        if (execSort || dragState.dragKind === DragKind.Move) {
            // Either animate inserted element to the new place, or animate
            // pickedEl back to the place it was visually moved from.
            let animElem = insertEl ?? dragState.pickedEl;
            let destRect = animElem.getClientRects()[0];
            const containerEl = dragState.to?.containerEl ?? dragState.from.containerEl;
            const animTimeMs = containerEl[expando].options.floatToPlaceAnimationTimeMs;
            setTransform(animElem, 'translateX', dragState.floatElPos.x - destRect.left, 0, animTimeMs);
            setTransform(animElem, 'translateY', dragState.floatElPos.y - destRect.top, 0, animTimeMs);
            setTransform(animElem, 'scale', dragState.floatElScale, 1, animTimeMs);
        }

        if (dragState.to) {
            // TODO: Handle better with AfterDrag state.
            removeBottomPaddingCorrection(dragState.to.containerEl, true);

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
    const fromContainerOptions = (dragEndEvent.from as any)[expando].options;

    if (dragEndEvent.dragExecuted) {
        if (dragEndEvent.to === dragEndEvent.from) {
            if (typeof fromContainerOptions.onInternalChange === 'function') {
                fromContainerOptions.onInternalChange(dragEndEvent);
            }
        } else {
            if (typeof fromContainerOptions.onDropToOtherContainer === 'function') {
                fromContainerOptions.onDropToOtherContainer(dragEndEvent);
            }
            const toContainerOptions = (dragEndEvent.to as any)[expando].options;
            if (typeof toContainerOptions.onDropFromOtherContainer === 'function') {
                toContainerOptions.onDropFromOtherContainer(dragEndEvent);
            }
        }
    }

    if (typeof fromContainerOptions.onDragFinished === 'function') {
        fromContainerOptions.onDragFinished(dragEndEvent);
    }
}

function anyState_container_PointerEnter(event: TypedActiveEvent<PointerEvent, ContainerEl>) {
    const containerEl = event.currentTarget;
    const containerData = containerEl[expando];
    containerHoverEntered(containerData);

    if (dragState?.state !== StateEnum.PendingDrag) {
        // Not dragging anything, so nothing to do.
        return;
    }
    if (containerEl === dragState.to?.containerEl) {
        // Already in this container, nothing to do.
        return;
    }

    maybeEnterContainer(containerData, event);
}

function anyState_container_PointerLeave(event: TypedActiveEvent<PointerEvent, ContainerEl>) {
    const containerEl = event.currentTarget;
    const containerData = containerEl[expando];
    containerHoverLeft(containerData);

    if (dragState?.state !== StateEnum.PendingDrag ||
            containerEl !== dragState.to?.containerEl) {
        return; // Not relevant.
    }

    // PointerLeave event might have been caused by releasing the touch or
    // button, however, we can't really tell. event.buttons === 0 works in
    // most browsers, but not iOS Safari (at least not in 14).
    // We will instead wait for other related events to dispatch. In case
    // this is the pointerup case, the drag will be over by the time the timer
    // executes.
    setTimeout(() => {
        // Make sure that the drag is still pending and we didn't move
        // to another container. In issue #8 we were hitting toEl === null here,
        // apparently because several timeouts from several left containers
        // got clamped together.
        if (dragState?.state === StateEnum.PendingDrag &&
                containerEl === dragState.to?.containerEl) {
            leaveContainer();
            // mousemove handler will figure the container to enter.
            // TODO: if it gets glitchy, call the mousemove handler here directly.
        }
    }, 0);
}

function maybeEnterContainer(
    containerData: ContainerData,
    evPlace: EvPlace,
    ignoreGuards?: boolean,
    forceInsertionIndex?: number,
    animatePlaceholderFromPickedItem?: boolean,
) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    let cData = containerData;
    let rect = cData.el.getClientRects()[0];
    if (!cData.options.allowDrop || !rect) {
        return false;
    }
    const xLast = dragState.currentPointerPos.x;
    if (ignoreGuards ||
            (xLast >= rect.left + rect.width * cData.options.enterGuardLeft + cData.options.enterGuardLeftPx &&
            xLast <= rect.right - rect.width * cData.options.enterGuardRight - cData.options.enterGuardRightPx)) {
        const insertionIndex = forceInsertionIndex ?? findInsertionIndexAtPoint(cData.el, evPlace);
        const eventualIndex = eventualIndexFromInsertionIndex(cData.el, insertionIndex);
        if (!dragState.forbiddenIndices.isForbiddenIndex(cData.el, dragState.pickedEl, insertionIndex)) {
            enterContainer(cData.el, insertionIndex, eventualIndex, animatePlaceholderFromPickedItem);
            return true;
        }
    }
    return false;
}

function enterContainer(
    toEl: ContainerEl,
    insertionIndex: number,
    eventualIndex: number,
    animatePlaceholderFromPickedItem?: boolean,
) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
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
        placeholderEl: getOrCreatePlaceholder(toEl),
        gapToPlaceholderOffset: 0,  // Will be set below.
    }

    updatePlaceholder(dragState.to, true);
    updateBottomPaddingCorrection();
    showPlaceholder(dragState.to.placeholderEl, animatePlaceholderFromPickedItem);

    animateMoveInsideContainer(toEl, getItemsInContainerEndIndex(toEl), eventualIndex);

    const containerOptions = toEl[expando].options;
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(dragState.from.containerEl, dragState.pickedEl);
    }
}

function leaveContainer() {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    if (!dragState.to) {
        return;
    }

    const leftContainerEl = dragState.to.containerEl;

    hidePlaceholder(dragState.to.placeholderEl);

    animateMoveInsideContainer(leftContainerEl, dragState.to.eventualIndex, getItemsInContainerEndIndex(leftContainerEl));

    removeBottomPaddingCorrection(leftContainerEl);

    dragState.to = undefined;

    const containerOptions = leftContainerEl[expando].options;
    if (typeof containerOptions.onContainerLeft === 'function') {
        containerOptions.onContainerLeft(leftContainerEl, dragState.pickedEl);
    }
}

function updateBottomPaddingCorrection() {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    if (!dragState.to) return;
    const toEl = dragState.to.containerEl;
    if (toEl && toEl !== dragState.from.containerEl) {
        const gapToPlaceholderOffset = dragState.to.gapToPlaceholderOffset;
        const animTimeMs =
            toEl[expando].options.animatePadding ?
                toEl[expando].options.animationTimeMs : 0;
        setTransform(toEl, 'paddingBottom', 'current', (_current, base) => {
            return base + gapToPlaceholderOffset;
        }, animTimeMs);
    }
}

function removeBottomPaddingCorrection(toEl: ContainerEl, immediately?: boolean) {
    if (dragState?.state !== StateEnum.PendingDrag) throw new BadStateError(StateEnum.PendingDrag);
    if (toEl !== dragState.from.containerEl) {
        if (immediately || !toEl[expando].options.animatePadding) {
            setTransform(toEl, 'paddingBottom', 'base');
        } else {
            const animTimeMs = toEl[expando].options.animationTimeMs;
            setTransform(toEl, 'paddingBottom', 'current', 'base', animTimeMs);
        }
    }
}

function createFloatEl(dragState: PreDragState): HTMLElement {
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
    init,
    DragKind,
};
