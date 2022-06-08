
import {
    DragKind,
    DragEndEvent,
} from './external-types';

// Options for an Omicron container.
// Actual options for a container are stored in
// containerEl[expando].options.
export class ContainerOptions {
    // CSS selector for draggable children of the container. The selector
    // is evaluated on pointerdown on the pressed item.
    // When left undefined, all elements in the container are draggable.
    // When the matcher fails, the pointerdown event is allowed to bubble,
    // otherwise the stopPropagation is called.
    // FUTURE COMPAT: At the moment, when the matcher fails, the pointerdown
    // event is allowed to bubble further (allowing e.g. an ancestor of the
    // container to be dragged). An option to control this behavior can be
    // added in the future.
    draggableSelector: string|null = null;
    // CSS selector for elements that can't be used to drag an item.
    // If any DOM element on the path from event.target (of pointerdown event)
    // to the candidate item matches this selector, the drag is not considered.
    // When the filter matcher hits any element on the path, the pointerdown
    // event is allowed to bubble, otherwise the stopPropagation is called.
    // FUTURE COMPAT: Options to control the bubbling behavior may be added,
    // similar as for draggableSelector.
    filterSelector: string|null = null;
    // CSS selector for handle element. If a handle selector is defined,
    // an item can be dragged only when grabbed by a handle-matching child
    // (or must be a handle itself).
    // If handleSelector is defined, and no element on the path from
    // event.target to the item match handleSelector, the behavior is the same
    // as if draggableSelector didn't match (draggableSelector itself must
    // match anyway).
    // FUTURE COMPAT: Options to control the bubbling behavior may be added,
    // similar as for draggableSelector.
    handleSelector: string|null = null;
    allowPull: DragKind|false = DragKind.Move;
    allowDrop: Boolean = true;
    // Minimal (euclidean, px) distance the pointer needs to move from the initial
    // position to trigger the drag before delay ends. Not applied for touch drag.
    minimalMoveMouse: number = 5
    // Exact length of the preDrag phase for touch, and maximal for other pointers.
    // For touch, this is a minimal time between pointerdown and the first touchmove
    // to start the drag. If a touchmove/touchend/touchcancel happens earlier,
    // the drag is cancelled, otherwise the drag starts `delay` ms after the initial
    // pointerdown event.
    // For mouse/pen, the drag starts _at the latest_ `delay` ms after the initial
    // pointerdown, unless the pointer is released (pointerup). The drag can start
    // earlier, if the pointer moves minimalMoveMouse px or more from initial point.
    delay: number = 220
    // Enter guards define the area of the container that may be used to drag
    // elements into it. After the container was entered (became toEl) the whole
    // area can be used to drag the item inside the container.
    // The guards define two margins, from the left end right edges of
    // the container that are excluded from this drag-accepting area.
    // This is useful when creating nested containers, to make it easier
    // to reorder "big" elements in the "big" parent container, without
    // accidentally entering the "small" child container.
    // Guards without suffix are a rate of width, those with 'px' are in pixels.
    enterGuardLeft: number = 0;
    enterGuardLeftPx: number = 0;
    enterGuardRight: number = 0;
    enterGuardRightPx: number = 0;
    // If true, the dragged element will hover over the place where it was
    // dragged from on the drag start, regardless of pointer position, but only
    // if this is a legal drop spot.
    keepPositionOnDragStart: boolean = true;
    // forbiddenInsertionIndicesFn can be used to make some indices invalid
    // as newIndex.
    // When entering new container (as toEl), forbiddenInsertionIndicesFn
    // defined _for that entered container_ is evaluated. The forbidden
    // indices are skipped when considering moves inside the toEl.
    // forbiddenInsertionIndicesFn will be called once per container during
    // each drag, and the result will be cached.
    forbiddenInsertionIndicesFn: ((containerEl:HTMLElement, activeEl: HTMLElement) => number[])|null = null;
    // createFloatElemFn: null,

    // Scale factor of floatEl transform. Can be used to make the dragged
    // element slightly smaller. The transform-origin for the scale is set
    // where the pointer is located on the original element.
    floatElScale: number = 1;

    // Chrome on Android will highlight every element that you tap with mild
    // blue color. That is irrelevant and distracting when using drag and drop,
    // so we turn this off by default, but you can disable that feature.
    setWebkitTapHighlightColorTransparent: boolean = true;

    // Argument to pass to navigator.vibrate when the drag is activated.
    // Set to 0 to disable.
    // The value is the length of vibration in milliseconds (it may be also
    // a pattern, but it really doesn't make sense with drag and drop).
    dragStartVibration: number = 25;

    // onBeforePreDrag: Called just before preDrag starts.
    // Return explicit `false` to cancel the drag.
    // Return DragKind to override the allowPull behavior for this particular
    // drag.
    onBeforePreDrag: ((containerEl: HTMLElement, activeEl: HTMLElement, event: MouseEvent|PointerEvent|TouchEvent) => void|DragKind|false)|null = null;

    // The element was chosen and the wait starts for the delay or minimal mouse
    // move to start dragging. The return value is ignored.
    // onPreDragStart(containerEl, activeEl, event)
    onPreDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement, event: MouseEvent|PointerEvent|TouchEvent) => void)|null = null;

    // Called just after the conditions for the drag start are met, but before
    // any styling (transforms) for the drag started, before placeholder
    // and floatEl are created. The return value is ignored.
    onBeforeDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement) => void)|null = null;

    // The floatEl to be placed under the pointer was created. You can edit its
    // internal DOM structure.
    // Use it to remove or override any "pointer-events: all" rules you might
    // have created inside the element, as they will break the drag logic.
    onFloatElementCreated: ((floatEl: HTMLElement, containerEl: HTMLElement, activeEl: HTMLElement) => void)|null = null;

    // The element is actually being dragged now. The return value is ignored.
    onDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement) => void)|null = null;

    // The container became toEl. This will fire right after onDragStart
    // for the fromEl (being also toEl) and then for every entered container.
    onContainerEntered: ((containerEl: HTMLElement, activeEl: HTMLElement) => void)|null = null;

    // The container is no longer toEl. This will fire at the end of
    // the drag, too, before the drag finish events.
    onContainerLeft: ((containerEl: HTMLElement, activeEl: HTMLElement) => void)|null = null;

    // The same event format is shared between onInternalChange,
    // onDropToOtherContainer, onDropFromOtherContainer.

    // Called on change where toEl === fromEl.
    onInternalChange: ((dragEndEvent: DragEndEvent) => void)|null = null;

    // Called on fromEl when toEl !== fromEl.
    onDropToOtherContainer: ((dragEndEvent: DragEndEvent) => void)|null = null;

    // Called on toEl when toEl !== fromEl.
    onDropFromOtherContainer: ((dragEndEvent: DragEndEvent) => void)|null = null;

    // The drag or pre-drag was finished. In case it was a sucessful drag,
    // called after relevant onInternalChange/onDrop callback, with the same
    // event.
    // onDragFinished(dragEndEvent)
    onDragFinished: ((dragEndEvent: DragEndEvent) => void)|null = null;
};
