import { dragState, StateEnum } from './state';

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

function animationFrame(timestamp: DOMHighResTimeStamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    if (dragState && dragState.state === StateEnum.PendingDrag) {
        // TODO: adjust for scroll or other changes of the base.
        const floatPosX =
            dragState.initialPickupRect.x +
            dragState.currentPointerPos.x -
            dragState.pickupPointerPos.x;
        const floatPosY =
            dragState.initialPickupRect.y +
            dragState.currentPointerPos.y -
            dragState.pickupPointerPos.y;
        dragState.floatEl.style.transform = `translate(${floatPosX}px,${floatPosY}px) scale(${dragState.floatElScale})`;
    }
}

export function uploadFloatElOnNextFrame() {
    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}
