declare global {
    interface CSSStyleDeclaration {
        webkitTapHighlightColor: string;
        webkitUserSelect: string;
        webkitTouchCallout: string;
    }
}
declare function initDragContainer(containerEl: HTMLElement, options: object): void;
declare const _default: {
    init: typeof initDragContainer;
};
export default _default;
