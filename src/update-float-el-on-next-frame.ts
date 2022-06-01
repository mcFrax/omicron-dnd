import { dragState, StateEnum } from './state';

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

function animationFrame(timestamp: DOMHighResTimeStamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    if (dragState && dragState.state === StateEnum.PendingDrag) {
        // TODO: adjust for scroll or other changes of the base.
        dragState.floatEl.style.transform = `translate(${dragState.floatElPos.x}px,${dragState.floatElPos.y}px) scale(${dragState.floatElScale})`;
    }
}

export function updateFloatElOnNextFrame() {
    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}
