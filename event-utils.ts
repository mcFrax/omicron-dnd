import { dragState, StateEnum } from "./state";

export function cancelIfOmicronActive(event: Event) {
    if (!dragState || (dragState.touchDrag && dragState.state === StateEnum.PreDrag)) {
        return;
    }
    if (event.cancelable) {
        event.preventDefault();
    }
}

export function cancelIfCancellable(event: Event) {
    if (event.cancelable) {
        event.preventDefault();
    }
}


const eventListenerOptionsArg = {passive: false, capture: false};

export type TypedActiveEvent<E extends Event = Event, T extends EventTarget = EventTarget> =
        E & {
            readonly currentTarget: T,
            readonly target: T extends Element ? Element : EventTarget,
        };
export type TypedEventListener<E extends Event = Event, T extends EventTarget = EventTarget> =
        (event: TypedActiveEvent<E, T>) => void
export type TypedEventListenerObject<E extends Event = Event, T extends EventTarget = EventTarget> = {
    handleEvent: TypedEventListener<E, T>,
};
type TypedEventListenerOrEventListenerObject<E extends Event = Event, T extends EventTarget = EventTarget> =
        TypedEventListener<E, T> | TypedEventListenerObject<E, T>;

// A subset of correct pairings. This is necessary to allow handlers taking the
// specific subtype of Event.
type ListenerPair<T extends EventTarget = EventTarget> =
    ['touchstart'|'touchmove'|'touchend'|'touchcancel', (e: TypedActiveEvent<TouchEvent, T>) => void] |
    ['mousedown'|'mousemove'|'mouseup'|'mouseenter'|'mouseleave', (e: TypedActiveEvent<MouseEvent, T>) => void] |
    ['pointerdown'|'pointermove'|'pointerup'|'pointercancel'|'pointerenter'|'pointerleave', (e: TypedActiveEvent<PointerEvent, T>) => void] |
    ['dragover', (e: TypedActiveEvent<DragEvent, T>) => void] |
    ['selectstart', TypedEventListenerOrEventListenerObject<Event, T>] |
    [string, TypedEventListenerOrEventListenerObject<Event, T>];

export function toggleListeners<T extends EventTarget = EventTarget>(
        toggleOn: boolean,
        element: T,
        eventHandlerPairs: ListenerPair<T>[]) {
    const toggle =
        toggleOn ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
    for (const [eventName, handler] of eventHandlerPairs) {
        toggle.call(element, eventName, handler as EventListener, eventListenerOptionsArg);
    }
}
