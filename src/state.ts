
import {
  DragKind,
} from './external-types';
import {
  Vec2D,
  ItemOriginalPlace,
  InsertionPlaceCandidate,
  InsertionPlace,
} from './base-types';
import { ForbiddenIndices } from './forbidden-indices';

export enum StateEnum {
  PreDrag,
  PendingDrag,
  AfterDrag,
}

type BaseDragState = {
  state: StateEnum,
  // PointerEvent.pointerId for verifying that all the pointer events
  // in a single drag are generated by a single device.
  pointerId: number
  // Target of original pointerdown event, necessary for delayed call
  // to releasePointerCapture on dragStart.
  pointerDownTarget: Element
  // Whether the current drag is triggered by touch.
  // Set in pointerdown and not reset after the drag.
  touchDrag: boolean
  // The kind of current drag (determined by pull property
  // of the original container).
  dragKind: DragKind  // TODO: Figure out how it really should be controlled, can we make it a bit more generic? Less descriptive?
  // TODO: UPDATE STALE DESCRIPTION.
  // The element being dragged. This is the very item instance that was initially
  // grabbed. This element stays in it's original place, but hidden (opacity: 0)
  // during the drag. The visible element following the mouse/touch is floatEl,
  // created as a clone of activeEl.
  // activeEl is moved to the new place at the end of the drag and animated from
  // the position of floatEl.
  // FUTURE COMPAT: It is likely that options will be added to:
  // - keep the activeEl at its original place, and let the client handle the drag
  //   effect,
  // - add an additional state in which the activeEl is hidden, and it's floatEl
  //   being animated into its place.
  // Always set in preDrag and drag, always null when drag/predrag inactive.
  pickedEl: HTMLElement
  // Container where drag started + item index in there.
  from: ItemOriginalPlace
  // DOMRect of pickedEl at the time of pointerdown event.
  initialPickupRect: DOMRect
  // Precomputed offsets.
  pickedElToGapOffset: number
  pickedElToNothingOffset: number
  // Pointer position from original pointerdown event.
  pickupPointerPos: Vec2D
  // Most recent pointer position.
  currentPointerPos: Vec2D
  // Offset from current cursor pos to expected left-top of floatEl (when
  // present). This is slightly different from just computing it from
  // pickupPointerPos and initialPickupRect, as it includes some extra offset
  // added from "snap out" effect.
  floatFromPointerOffset: Vec2D
  // Current scale factor for floatEl. Set from floatElScale option of original
  // container.
  // This value is added as scale(floatElScale) to floatEl's CSS transform.
  floatElScale: number
  // Minimal (euclidean, px) distance the pointer needs to move from the initial
  // position to trigger the drag before delay ends. Not applied for touch drag.
  minimalMoveMouse: number
  // Forbidden indices cache.
  forbiddenIndices: ForbiddenIndices
  // Snap scroll cooldown. Holds snap scrollers that were recently activated,
  // to avoid immediate re-activation, as well as allow reactivation after
  // cooldown period.
  // This would be better as some opaque class implemented inside scrollers.ts,
  // but for now that would cause a circular dependency that I don't have
  // satisfying solution for.
  recentSnapScrollActivations: Map<HTMLElement, number>
};

export type PreDragState = BaseDragState & {
  state: StateEnum.PreDrag
  // Pre-drag timeout measures the delay in the preDrag phase.
  // This is the id value returned by setTimeout.
  preDragTimeoutId: ReturnType<typeof setTimeout>
  // Stubs of some common fields so that they are defined on DragState.
  floatEl?: undefined
  to?: undefined
};

export type PendingDragState = BaseDragState & {
  state: StateEnum.PendingDrag
  // Current target container and index + placeholder information.
  to?: InsertionPlaceCandidate
  // TODO: UPDATE STALE DESCRIPTION.
  // A clone of activeEl, created when starting drag and destroyed immediately
  // when the drag ends. Use onFloatElementCreated callback to modify it.
  // The CSS width and height of floatEl are set to width and height of activeEl
  // at the time of creation.
  // FUTURE COMPAT: It is likely that options to turn floatEl off or
  // use a custom function to create it will be added in the future.
  floatEl: HTMLElement
  floatElPos: Vec2D
};

export type AfterDragState = BaseDragState & {
  state: StateEnum.AfterDrag
  // Either pickedEl after being inserted into target
  // (or not moved at all, in case of failed drag)
  // or it's clone inserted at the target place.
  insertedEl: HTMLElement
  floatEl: HTMLElement
  to?: InsertionPlace
};

export type DragState = PreDragState | PendingDragState | AfterDragState;

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

export class BadStateError extends Error {
  constructor(expectedState: StateEnum) {
    super(`Drag state assertion failed: expected state ${StateEnum[expectedState]}, but actual is ${dragState ? StateEnum[dragState.state] : '<no drag>'}`);
  }
}

export let dragState: DragState|null = null;

export function setDragState(newDragState: DragState|null) {
  // TODO: Some logic might happen here, like changing the listeners, perhaps.
  dragState = newDragState;
}
