declare global {
    interface CSSStyleDeclaration {
        webkitTapHighlightColor: string;
        webkitUserSelect: string;
        webkitTouchCallout: string;
    }
}
interface DragEndEvent {
    dragExecuted: boolean;
    item: HTMLElement;
    from: HTMLElement;
    to: HTMLElement | null;
    oldIndex: number;
    newIndex: number | null;
}
declare class ContainerOptions {
    draggableSelector: string | null;
    filterSelector: string | null;
    handleSelector: string | null;
    enterGuardLeft: number;
    enterGuardLeftPx: number;
    enterGuardRight: number;
    enterGuardRightPx: number;
    forbiddenInsertionIndicesFn: ((containerEl: HTMLElement, activeEl: HTMLElement) => number[]) | null;
    floatElScale: number;
    setWebkitTapHighlightColorTransparent: boolean;
    dragStartVibration: number;
    onBeforePreDrag: ((containerEl: HTMLElement, activeEl: HTMLElement, event: MouseEvent | PointerEvent | TouchEvent) => void | false) | null;
    onPreDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement, event: MouseEvent | PointerEvent | TouchEvent) => void) | null;
    onBeforeDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement) => void) | null;
    onFloatElementCreated: ((floatEl: HTMLElement, containerEl: HTMLElement, activeEl: HTMLElement) => void) | null;
    onDragStart: ((containerEl: HTMLElement, activeEl: HTMLElement) => void) | null;
    onContainerEntered: ((containerEl: HTMLElement, activeEl: HTMLElement) => void) | null;
    onContainerLeft: ((containerEl: HTMLElement, activeEl: HTMLElement) => void) | null;
    onInternalChange: ((dragEndEvent: DragEndEvent) => void) | null;
    onDropToOtherContainer: ((dragEndEvent: DragEndEvent) => void) | null;
    onDropFromOtherContainer: ((dragEndEvent: DragEndEvent) => void) | null;
    onDragFinished: ((dragEndEvent: DragEndEvent) => void) | null;
}
declare function initDragContainer(containerEl: HTMLElement, options: Partial<ContainerOptions>): void;
declare const _default: {
    init: typeof initDragContainer;
};
export default _default;
