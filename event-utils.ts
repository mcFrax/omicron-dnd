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

// A subset of correct pairings. This is necessary to allow handlers taking the
// specific subtype of Event.
type ListenerPair =
    ['touchstart'|'touchmove'|'touchend'|'touchcancel', (e: TouchEvent) => void] |
    ['mousedown'|'mousemove'|'mouseup'|'mouseenter'|'mouseleave', (e: MouseEvent) => void] |
    ['pointerdown'|'pointermove'|'pointerup'|'pointercancel'|'pointerenter'|'pointerleave', (e: PointerEvent) => void] |
    ['dragover', (e: DragEvent) => void] |
    ['selectstart', EventListenerOrEventListenerObject] |
    [string, EventListenerOrEventListenerObject];

export function toggleListeners(
        toggleOn: boolean,
        element: HTMLElement|Document,
        eventHandlerPairs: ListenerPair[]) {
    const toggle =
        toggleOn ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
    for (const [eventName, handler] of eventHandlerPairs) {
        toggle.call(element, eventName, handler as EventListener, eventListenerOptionsArg);
    }
}
