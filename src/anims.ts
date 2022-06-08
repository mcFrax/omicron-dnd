
export const animMs = 100;

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

type TransformName = 'translateX' | 'translateY' | 'scale' | 'rotate';
type TransformUnit = '' | 'px' | 'deg';
const unitForTransform: Record<TransformName, TransformUnit> = {
    translateX: 'px',
    translateY: 'px',
    scale: '',
    rotate: 'deg',
};
const defaultForTransform: Record<TransformName, number> = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotate: 0,
};


type MaybeAnimTimespan = {
    startTime: DOMHighResTimeStamp
    endTime: DOMHighResTimeStamp
} | {
    startTime: null
    endTime: null
};

type SingleParamAnim = {
    elem: HTMLElement,
    transform: TransformName,
    unit: TransformUnit,
    startValue: number
    currentValue: number
    targetValue: number
    durationMs: number
    pending: boolean
} & MaybeAnimTimespan;

type ElementAnims = {
    pendingCount: number,
    // We need to apply all non-zero transforms together anyway, so let's just
    // keep an array.
    allTransforms: SingleParamAnim[],
    resolveOnFinish: (() => void) | null,
};

let elemsWithPending: Map<HTMLElement, ElementAnims> = new Map();
let elemsWithTransforms: Map<HTMLElement, ElementAnims> = new Map();

function getAnim(elem: HTMLElement, transform: TransformName): SingleParamAnim | undefined {
    const elemAnims = elemsWithTransforms.get(elem);
    return elemAnims?.allTransforms.find((anim) => anim.transform === transform);
}

function animationFrame(timestamp: DOMHighResTimeStamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    let needsNextFrame = false;
    // Iterate backwards to allow simple removal.
    for (let [elem, anims] of elemsWithPending.entries()) {
        if (elemAnimationFrame(timestamp, elem, anims)) {
            needsNextFrame = true;
        }
    }
    if (needsNextFrame) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}

function getCurrentTransform(anims: ElementAnims): string {
    return anims.allTransforms.map(
        (anim) => `${anim.transform}(${anim.currentValue}${anim.unit})`
    ).join(' ');
}

function elemAnimationFrame(timestamp: DOMHighResTimeStamp, elem: HTMLElement, anims: ElementAnims) {
    if (anims.pendingCount === 0) return; // Sanity check.
    for (let i = anims.allTransforms.length - 1; i >= 0; --i) {
        if (anims.allTransforms[i].pending) {
            paramAnimationFrame(timestamp, anims, anims.allTransforms[i], i);
        }
    }
    elem.style.transform = getCurrentTransform(anims);
    if (anims.allTransforms.length === 0) {
        // Everything zeroed and it's no longer necessary to keep the record.
        elemsWithPending.delete(elem);
        elemsWithTransforms.delete(elem);
    } else if (anims.pendingCount === 0) {
        elemsWithPending.delete(elem);
    }
    return anims.pendingCount > 0;
}

function paramAnimationFrame(
    timestamp: DOMHighResTimeStamp,
    anims: ElementAnims,
    anim: SingleParamAnim,
    animIdx: number,
) {
    if (!anim.startTime) {
        anim.startTime = timestamp;
        anim.endTime = timestamp + anim.durationMs;
        return;  // Do nothing with currentValue.
    }
    const advancementRate =
        timestamp >= anim.endTime ? 1 : (timestamp - anim.startTime) / anim.durationMs;
    anim.currentValue =
        advancementRate * anim.targetValue + (1 - advancementRate) * anim.startValue;
    if (advancementRate >= 1) {
        anims.pendingCount -= 1;
        anim.pending = false;
        if (anim.currentValue === defaultForTransform[anim.transform]) {
            // Remove the transform.
            anims.allTransforms[animIdx] = anims.allTransforms[anims.allTransforms.length - 1];
            anims.allTransforms.pop();
        }
    }
}

export function setTransform(
    elem: HTMLElement,
    transform: TransformName,
    startValueOrFn: 'current'|number|((previous: number) => number),
    targetValueOrFn?: undefined,
    durationMs?: undefined,
): void;
export function setTransform(
    elem: HTMLElement,
    transform: TransformName,
    startValueOrFn: 'current'|number|((previous: number) => number),
    targetValueOrFn?: number|((startValue: number, previous: number) => number)|undefined,
    durationMs?: number,
): void;

export function setTransform(
    elem: HTMLElement,
    transform: TransformName,
    startValueOrFn: 'current'|number|((previous: number) => number),
    targetValueOrFn: number|((startValue: number, previous: number) => number)|undefined,
    durationMs: number = animMs,
) {
    const preExistingElemAnims = elemsWithTransforms.get(elem);
    const preExisiting = getAnim(elem, transform);
    const previousValue = preExisiting?.currentValue ?? defaultForTransform[transform];
    const startValue =
        (startValueOrFn ===  'current') ? previousValue :
            (typeof startValueOrFn === 'function') ?
                startValueOrFn(previousValue) : startValueOrFn;

    const targetValue = targetValueOrFn === undefined ? startValue :
            (typeof targetValueOrFn === 'function') ?
                targetValueOrFn(startValue, previousValue) : targetValueOrFn;

    if (targetValue === startValue) {
        durationMs = 0;
    }
    const pendingDiff = 1 - Number(preExisiting?.pending ?? 0);

    const anim: SingleParamAnim =
        Object.assign(
            preExisiting ?? {
                elem,
                transform,
                unit: unitForTransform[transform],
            }, {
                startValue,
                targetValue,
                durationMs,
                currentValue: startValue,
                pending: true,
                startTime: null,
                endTime: null,
            },
        );
    if (preExistingElemAnims && !preExisiting) {
        preExistingElemAnims.allTransforms.push(anim);
    }
    const elemAnims = preExistingElemAnims ?? {
        pendingCount: 0,
        allTransforms: [anim],
        resolveOnFinish: null,
    };
    elemAnims.pendingCount += pendingDiff;

    elemsWithTransforms.set(elem, elemAnims);
    elemsWithPending.set(elem, elemAnims);

    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}
