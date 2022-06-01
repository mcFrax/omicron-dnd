import { DragKind } from "./external-types";
import { ContainerOptions } from "./options";
declare global {
    interface Node {
        cloneNode<T extends Node>(this: T, deep?: boolean | undefined): T;
    }
    interface CSSStyleDeclaration {
        webkitTapHighlightColor: string;
    }
}
declare function initDragContainer(container: HTMLElement, options?: Partial<ContainerOptions>): void;
declare const _default: {
    init: typeof initDragContainer;
    DragKind: typeof DragKind;
};
export default _default;
