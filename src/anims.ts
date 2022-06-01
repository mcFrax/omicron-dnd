
export const animMs = 100;

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.

// Currently running requestAnimationFrame-based animations.
// FUTURE COMPAT:
// At the moment, only y-translation of CSS-transform can be animated,
// but it may be extended to other properties or replaced with CSS-transition
// based animations.
// The Anim class is written to support animating several elements in parallel,
// however it is not used that way and most likely it will eventually be
// converted to only handle a single element, but this is not guaranted.
let anims: Anim[] = [];
// Anim elements from Anim, but keyed by the animated elements.
// Theoretically can contain more entries than anims, if we have Anim handling
// several elements in parallel, but this feature is not currently used.
let animsByElem: Map<HTMLElement, Anim> = new Map();
// Most recent x and y values (in pixel) set in translate(x, y) part
// of the CSS transform set on an element animated with Anim. If the transform
//  is unset or set to translate(0, 0), no entry is stored.
let transformsByElem: Map<HTMLElement, [number, number]>  = new Map();

function animationFrame(timestamp: DOMHighResTimeStamp) {
    animFrameRequestId = 0;  // Allow scheduling for the next frame.
    let needsNextFrame = false;
    // Iterate backwards to allow simple removal.
    for (let i = anims.length - 1; i >= 0; --i) {
        if (anims[i].animationFrame(timestamp)) {
            needsNextFrame = true;
        } else {
            anims[i].remove();
        }
    }
    if (needsNextFrame) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}

function identity<T>(v: T) {
    return v;
}

// Anim is implemented to hold an array of elems, but we actually rely on it
// holding only one (which means we can delete the whole old anim when adding
// new one for the same element).
export class Anim {
    public static start(
            parentEl: HTMLElement,
            elems: HTMLElement[],
            targetYTranslation: number,
            durationMs: number,
            startYTranslation: number|null|((previous: number) => number) = null) {
        const initialTranslation =
            (startYTranslation === null) ? identity :
                (typeof startYTranslation === 'function') ?
                    startYTranslation : (() => startYTranslation);

        for (let elem of elems) {
            const actualStartY = initialTranslation((transformsByElem.get(elem) || [0, 0])[1]);

            // Immediately make sure that the elements are where they are supposed to start.
            elem.style.transform = `translateY(${actualStartY}px)`;

            if (actualStartY !== targetYTranslation) {
                Anim.add(elem, new Anim(parentEl, [elem], actualStartY, targetYTranslation, durationMs));
            } else {
                let currentAnim = animsByElem.get(elem);
                if (currentAnim) {
                    currentAnim.remove();
                }
            }
        }
        if (!animFrameRequestId) {
            animFrameRequestId = requestAnimationFrame(animationFrame);
        }
    }

    private static add(elem: HTMLElement, anim: Anim) {
        // Replace any old anim for this elem.
        let previousAnim = animsByElem.get(elem);
        if (previousAnim) {
            anims[anims.indexOf(previousAnim)] = anim;
        } else {
            anims.push(anim);
        }
        animsByElem.set(elem, anim);
    }

    private constructor(
            parentEl: HTMLElement,
            elems: HTMLElement[],
            startYTranslation: number,
            targetYTranslation: number,
            durationMs: number) {
        // assert(elems.length);
        this.parentEl = parentEl;
        this.elems = elems;
        this.startYTranslation = startYTranslation;
        this.targetYTranslation = targetYTranslation;
        this.durationMs = durationMs;
        this.startTime = null;  // Will be filled in in the animation frame.
        this.endTime = null;
    }

    // Will return true if the next frame should be requested.
    animationFrame(timestamp: DOMHighResTimeStamp) {
        if (!this.startTime) {
            this.startTime = timestamp;
            this.endTime = timestamp + this.durationMs;
            return true;  // Do nothing
        }
        // Note: startTime is defined, so endTime is, too.
        let advancementRate =
            timestamp >= (this.endTime as number) ? 1 : (timestamp - this.startTime) / this.durationMs;
        let currentYTranslation =
            advancementRate * this.targetYTranslation + (1 - advancementRate) * this.startYTranslation;
        let transformString = `translateY(${currentYTranslation}px)`;
        for (let elem of this.elems) {
            if (currentYTranslation === 0) {
                transformsByElem.delete(elem);
            } else {
                transformsByElem.set(elem, [0, currentYTranslation]);
            }
            elem.style.transform = transformString;
        }
        return (advancementRate < 1);
    }

    remove() {
        for (let elem of this.elems) {
            animsByElem.delete(elem);
        }
        anims[anims.indexOf(this)] = anims[anims.length - 1];
        anims.pop();
    }

    private parentEl: HTMLElement;
    private elems: HTMLElement[];
    private startYTranslation: number;
    private targetYTranslation: number;
    private durationMs: number;
    private startTime: DOMHighResTimeStamp|null;  // Will be filled in in the animation frame.
    private endTime: DOMHighResTimeStamp|null;
}
