import { ContainerOptions } from './options';

export interface ContainerData {
    el: ContainerEl,
    options: ContainerOptions,
    domDepth: number,
}

export const expando = '__omicronDragAndDropData__';

type WithExpando = {
  [expando]?: ContainerData,
}

declare global {
    interface HTMLElement extends WithExpando {
    }
}

export type ContainerEl = HTMLElement & Required<WithExpando>;
