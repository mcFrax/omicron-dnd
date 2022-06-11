import { getComputedStyleOr0, KnownLengthProperty } from "./style-basics";

export const animMs = 100;

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

type TransformName =
    'translateX' | 'translateY' |
    'scale' | 'scaleX' | 'scaleY' |
    'rotate';
type TransformUnit = '' | 'px' | 'deg';
const unitForTransform: Record<TransformName, TransformUnit> = {
    translateX: 'px',
    translateY: 'px',
    scale: '',
    scaleX: '',
    scaleY: '',
    rotate: 'deg',
};
const defaultForTransform: Record<TransformName, number> = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
};

const unitForProp: typeof unitForTransform & Record<KnownLengthProperty, 'px'> = {
    ...unitForTransform,
    marginBottom: 'px',
    marginTop: 'px',
    marginLeft: 'px',
    marginRight: 'px',
    paddingBottom: 'px',
    paddingTop: 'px',
    paddingLeft: 'px',
    paddingRight: 'px',
    height: 'px',
    width: 'px',
    maxHeight: 'px',
    maxWidth: 'px',
    rowGap: 'px',
    columnGap: 'px',
};

type TransformOrProperty = TransformName | KnownLengthProperty;

export function AssertThatTransformNameAndKnownLengthPropertyAreDisjoint(
    t: TransformName,
    p: KnownLengthProperty,
): [Exclude<TransformName, KnownLengthProperty>, Exclude<KnownLengthProperty, TransformName>] {
    return [t, p];
}

function isTransform(prop: TransformOrProperty): prop is TransformName {
    return prop in unitForTransform;
}

type MaybeAnimTimespan = {
    startTime: DOMHighResTimeStamp
    endTime: DOMHighResTimeStamp
} | {
    startTime: null
    endTime: null
};

type SingleParamAnim = {
    elem: HTMLElement,
    prop: TransformOrProperty,
    unit: TransformUnit,
    startValue: number
    currentValue: number
    targetValue: number
    clearValue: number
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

function getAnim(elem: HTMLElement, prop: TransformOrProperty): SingleParamAnim | undefined {
    const elemAnims = elemsWithTransforms.get(elem);
    return elemAnims?.allTransforms.find((anim) => anim.prop === prop);
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

function elemAnimationFrame(timestamp: DOMHighResTimeStamp, elem: HTMLElement, anims: ElementAnims) {
    if (anims.pendingCount === 0) return; // Sanity check.
    const transforms: string[] = [];
    for (let i = anims.allTransforms.length - 1; i >= 0; --i) {
        if (anims.allTransforms[i].pending) {
            paramAnimationFrame(timestamp, anims, anims.allTransforms[i], i, transforms);
        }
    }
    elem.style.transform = transforms.join(' ');
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
    transforms: string[],
) {
    updateCurrentValueOnFrame(timestamp, anim, anims, animIdx);

    applyCurrentValue(anim, transforms);
}

function updateCurrentValueOnFrame(
    timestamp: DOMHighResTimeStamp,
    anim: SingleParamAnim,
    anims: ElementAnims,
    animIdx: number,
) {
    if (!anim.startTime) {
        anim.startTime = timestamp;
        anim.endTime = timestamp + anim.durationMs;
        return;
    }
    const advancementRate =
        timestamp >= anim.endTime ? 1 : (timestamp - anim.startTime) / anim.durationMs;
    anim.currentValue =
        advancementRate * anim.targetValue + (1 - advancementRate) * anim.startValue;

    if (advancementRate >= 1) {
        anims.pendingCount -= 1;
        anim.pending = false;
        if (anim.currentValue === anim.clearValue) {
            // Remove the transform.
            anims.allTransforms[animIdx] = anims.allTransforms[anims.allTransforms.length - 1];
            anims.allTransforms.pop();
        }
    }
}

function applyCurrentValue(
    anim: SingleParamAnim,
    transforms: string[],
) {
    if (isTransform(anim.prop)) {
        if (anim.currentValue !== anim.clearValue) {
            transforms.push(`${anim.prop}(${anim.currentValue}${anim.unit})`);
        }
    } else if (anim.pending || anim.currentValue !== anim.clearValue) {
        anim.elem.style[anim.prop] = `${anim.currentValue}${anim.unit}`;
    } else {
        anim.elem.style[anim.prop] = '';
    }
}

function getClearValue(elem: HTMLElement, prop: TransformOrProperty) {
    if (isTransform(prop)) {
        return defaultForTransform[prop];
    }
    if (elem.style[prop] === '') {
        return getComputedStyleOr0(elem, prop);
    }
    // The value is set on the element, and we should never unset it.
    return NaN;
}

function getInitialValue(elem: HTMLElement, prop: TransformOrProperty) {
    if (isTransform(prop)) {
        return defaultForTransform[prop];
    }
    return getComputedStyleOr0(elem, prop);
}

type StartValueOrFn = 'current'|'base'|number|((previous: number) => number);
type TargetValueOrFn = number|((startValue: number, previous: number) => number);

export function setTransform(
    elem: HTMLElement,
    prop: TransformOrProperty,
    startValueOrFn: StartValueOrFn,
    targetValueOrFn?: undefined,
    durationMs?: undefined,
): void;
export function setTransform(
    elem: HTMLElement,
    prop: TransformOrProperty,
    startValueOrFn: StartValueOrFn,
    targetValueOrFn?: TargetValueOrFn|undefined,
    durationMs?: number,
): void;

export function setTransform(
    elem: HTMLElement,
    prop: TransformOrProperty,
    startValueOrFn: StartValueOrFn,
    targetValueOrFn: TargetValueOrFn|undefined,
    durationMs: number = animMs,
) {
    const preExistingElemAnims = elemsWithTransforms.get(elem);
    const preExisiting = getAnim(elem, prop);
    const clearValue = preExisiting?.clearValue ?? getClearValue(elem, prop);
    const previousValue = preExisiting?.currentValue ?? getInitialValue(elem, prop);
    const startValue =
        (startValueOrFn ===  'current') ? previousValue :
            (startValueOrFn ===  'base') ? clearValue :
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
                prop,
                unit: unitForProp[prop],
                clearValue,
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
