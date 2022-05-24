
import {
  DragKind,
  Vec2D,
  ItemPlace,
  InsertionPlaceCandidate,
} from './base-types';
import ForbiddenIndices from './forbidden-indices';

export enum StateEnum {
  PreDrag,
  PendingDrag,
  AfterDrag,
}

type BaseDragState = {
  state: StateEnum,
  pointerId: number
  pointerDownTarget: HTMLElement
  touchDrag: boolean
  dragKind: DragKind  // TODO: Figure out how it really should be controlled, can we make it a bit more generic? Less descriptive?
  pickedEl: HTMLElement
  from: ItemPlace
  initialPickupRect: DOMRect
  pickupPointerPos: Vec2D
  currentPointerPos: Vec2D
  floatPos: Vec2D
  pointerOffset: Vec2D // pickupPointerPos offset wrt initialPickupRect
  forbiddenIndices: ForbiddenIndices
};

type PreDragState = BaseDragState & {
  state: StateEnum.PreDrag
  preDragTimeoutId: number
};

type PendingDragState = BaseDragState & {
  state: StateEnum.PendingDrag
  to?: InsertionPlaceCandidate
  floatEl: HTMLElement
  floatElScale: number
};

type AfterDragState = BaseDragState & {
  state: StateEnum.AfterDrag
  insertedEl: HTMLElement
  floatEl: HTMLElement
  // to: ItemPlace
};

// TODO: Scrollers

type DragState = PreDragState | PendingDragState | AfterDragState;

// Perhaps it would be better to write these assertions inline, and let
// Typescript figure out that they are, indeed, correct.

export function isPreDrag(state?: DragState): state is PreDragState {
  return !!state && state.state === StateEnum.PreDrag;
}

export function isPendingDrag(state?: DragState): state is PendingDragState {
  return !!state && state.state === StateEnum.PendingDrag;
}

export function isAfterDrag(state?: DragState): state is AfterDragState {
  return !!state && state.state === StateEnum.AfterDrag;
}

export let dragState: DragState|null = null;

function transform(inState: PreDragState): PendingDragState {
  return {
    ...inState,
    state: StateEnum.PendingDrag,
    floatEl: document.documentElement,
    floatElScale: 1,
  };
}
