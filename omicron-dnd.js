/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./animate-move.ts":
/*!*************************!*\
  !*** ./animate-move.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "animateMoveInsideContainer": () => (/* binding */ animateMoveInsideContainer)
/* harmony export */ });
/* harmony import */ var _anims__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./anims */ "./anims.ts");
/* harmony import */ var _dom_traversal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dom-traversal */ "./dom-traversal.ts");
/* harmony import */ var _external_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./external-types */ "./external-types.ts");
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./state */ "./state.ts");




function animateMoveInsideContainer(containerEl, previousEventualIndex, newEventualIndex) {
    // There are 4 groups of elements, adjusted by different offsets:
    //
    // 1. no offset
    // All elements before oldIndex (in fromEl) or newIndex
    // (in containerEl).
    // When fromEl === containerEl, both conditions are required.
    //
    // 2. activeToPlaceholderOffset
    // Elements in fromEl with index after max(newIndex, oldIndex).
    //
    // 3. activeToNothingOffset
    // Elements in fromEl that are after oldIndex, except those
    // after newIndex when fromEl === containerEl.
    //
    // 4. nothingToPlaceholderOffset
    // All elements after newIndex except those in fromEl that are also
    // after oldIndex.
    //
    // I though that I'd do something smart to change the elements
    // that are affected in groups, but no I'm thinking I'll go over
    // all potentially effected elements and run the above logic for
    // each of them.
    var _a, _b;
    if ((_state__WEBPACK_IMPORTED_MODULE_3__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_3__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_3__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_3__.StateEnum.PendingDrag)
        return;
    // TODO: Extract, deduplicate, cache.
    const activeElHeight = _state__WEBPACK_IMPORTED_MODULE_3__.dragState.pickedEl.offsetHeight;
    const activeToPlaceholderOffset = _state__WEBPACK_IMPORTED_MODULE_3__.dragState.to ? _state__WEBPACK_IMPORTED_MODULE_3__.dragState.to.placeholderEl.offsetHeight - activeElHeight : 0;
    const activeToNothingOffset = -activeElHeight - 8;
    const nothingToPlaceholderOffset = (_b = (_a = _state__WEBPACK_IMPORTED_MODULE_3__.dragState.to) === null || _a === void 0 ? void 0 : _a.placeholderEl.offsetHeight) !== null && _b !== void 0 ? _b : 0;
    let maxItemIndex = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_1__.getItemsInContainerEndIndex)(containerEl) - 1;
    let affectedStart = Math.min(maxItemIndex, Math.min(newEventualIndex, previousEventualIndex));
    let affectedEnd = Math.min(maxItemIndex, Math.max(newEventualIndex, previousEventualIndex));
    if (maxItemIndex === -1) {
        return; // Empty container, nothing to animate.
    }
    // Note: we are using actual oldIndex below, not previousIndex.
    // This is because we have to deal with activeEl affecting offsets,
    // even though it's not visible.
    // Previous index doesn't matter any more here, it was only
    // for determining the affected range.
    for (let i = affectedStart; i <= affectedEnd; ++i) {
        let otherEl = containerEl.children[i];
        if (_state__WEBPACK_IMPORTED_MODULE_3__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_2__.DragKind.Move && otherEl === _state__WEBPACK_IMPORTED_MODULE_3__.dragState.pickedEl)
            continue;
        let afterOld = (_state__WEBPACK_IMPORTED_MODULE_3__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_2__.DragKind.Move &&
            containerEl === _state__WEBPACK_IMPORTED_MODULE_3__.dragState.from.containerEl &&
            i >= _state__WEBPACK_IMPORTED_MODULE_3__.dragState.from.index);
        let afterNew = afterOld ? i > newEventualIndex : i >= newEventualIndex;
        if (afterNew && afterOld) {
            _anims__WEBPACK_IMPORTED_MODULE_0__.Anim.start(containerEl, [otherEl], activeToPlaceholderOffset, _anims__WEBPACK_IMPORTED_MODULE_0__.animMs);
        }
        else if (afterNew) {
            _anims__WEBPACK_IMPORTED_MODULE_0__.Anim.start(containerEl, [otherEl], nothingToPlaceholderOffset, _anims__WEBPACK_IMPORTED_MODULE_0__.animMs);
        }
        else if (afterOld) {
            _anims__WEBPACK_IMPORTED_MODULE_0__.Anim.start(containerEl, [otherEl], activeToNothingOffset, _anims__WEBPACK_IMPORTED_MODULE_0__.animMs);
        }
        else {
            _anims__WEBPACK_IMPORTED_MODULE_0__.Anim.start(containerEl, [otherEl], 0, _anims__WEBPACK_IMPORTED_MODULE_0__.animMs);
        }
    }
}


/***/ }),

/***/ "./anims.ts":
/*!******************!*\
  !*** ./anims.ts ***!
  \******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Anim": () => (/* binding */ Anim),
/* harmony export */   "animMs": () => (/* binding */ animMs),
/* harmony export */   "transformsByElem": () => (/* binding */ transformsByElem)
/* harmony export */ });
const animMs = 100;
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
let anims = [];
// Anim elements from Anim, but keyed by the animated elements.
// Theoretically can contain more entries than anims, if we have Anim handling
// several elements in parallel, but this feature is not currently used.
let animsByElem = new Map();
// Most recent x and y values (in pixel) set in translate(x, y) part
// of the CSS transform set on an element animated with Anim. If the transform
//  is unset or set to translate(0, 0), no entry is stored.
// TODO: Invent some better interface to tap into this information than just
// exporting it.
let transformsByElem = new Map();
function animationFrame(timestamp) {
    animFrameRequestId = 0; // Allow scheduling for the next frame.
    let needsNextFrame = false;
    // Iterate backwards to allow simple removal.
    for (let i = anims.length - 1; i >= 0; --i) {
        if (anims[i].animationFrame(timestamp)) {
            needsNextFrame = true;
        }
        else {
            anims[i].remove();
        }
    }
    if (needsNextFrame) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}
// Anim is implemented to hold an array of elems, but we actually rely on it
// holding only one (which means we can delete the whole old anim when adding
// new one for the same element).
class Anim {
    constructor(parentEl, elems, startYTranslation, targetYTranslation, durationMs) {
        // assert(elems.length);
        this.parentEl = parentEl;
        this.elems = elems;
        this.startYTranslation = startYTranslation;
        this.targetYTranslation = targetYTranslation;
        this.durationMs = durationMs;
        this.startTime = null; // Will be filled in in the animation frame.
        this.endTime = null;
    }
    static start(parentEl, elems, targetYTranslation, durationMs, startYTranslation = null) {
        // How the actual, visible position differs from offsetTop.
        if (startYTranslation === null) {
            // TODO: Group the elements with the same initial translation.
            // Round the initial translation to avoid sub-pixel differences.
            // Alternatively work it around so that we _know_ all elements
            // have the same starting transform - generating all these rects
            // is a lot of useless computation and allocation.
            for (let elem of elems) {
                startYTranslation = (transformsByElem.get(elem) || [0, 0])[1];
                if (startYTranslation !== targetYTranslation) {
                    Anim.add(elem, new Anim(parentEl, [elem], startYTranslation, targetYTranslation, durationMs));
                }
                else {
                    let currentAnim = animsByElem.get(elem);
                    if (currentAnim) {
                        currentAnim.remove();
                    }
                }
            }
        }
        else {
            // Immediately make sure that the elements are where they are supposed to start.
            let transformString = `translateY(${startYTranslation}px)`;
            for (let elem of elems) {
                elem.style.transform = transformString;
                Anim.add(elem, new Anim(parentEl, [elem], startYTranslation, targetYTranslation, durationMs));
            }
        }
        if (!animFrameRequestId) {
            animFrameRequestId = requestAnimationFrame(animationFrame);
        }
    }
    static add(elem, anim) {
        // Replace any old anim for this elem.
        let previousAnim = animsByElem.get(elem);
        if (previousAnim) {
            anims[anims.indexOf(previousAnim)] = anim;
        }
        else {
            anims.push(anim);
        }
        animsByElem.set(elem, anim);
    }
    // Will return true if the next frame should be requested.
    animationFrame(timestamp) {
        if (!this.startTime) {
            this.startTime = timestamp;
            this.endTime = timestamp + this.durationMs;
            return true; // Do nothing
        }
        // Note: startTime is defined, so endTime is, too.
        let advancementRate = timestamp >= this.endTime ? 1 : (timestamp - this.startTime) / this.durationMs;
        let currentYTranslation = advancementRate * this.targetYTranslation + (1 - advancementRate) * this.startYTranslation;
        let transformString = `translateY(${currentYTranslation}px)`;
        for (let elem of this.elems) {
            if (currentYTranslation === 0) {
                transformsByElem.delete(elem);
            }
            else {
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
}


/***/ }),

/***/ "./click-blocker.ts":
/*!**************************!*\
  !*** ./click-blocker.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "preventImmediateClick": () => (/* binding */ preventImmediateClick),
/* harmony export */   "preventNextClick": () => (/* binding */ preventNextClick),
/* harmony export */   "removeClickBlocker": () => (/* binding */ removeClickBlocker)
/* harmony export */ });
function preventSingleHandler(event) {
    // We can't really prevent the browser for generating a click, but we
    // can capture it and stop all effects.
    event.stopPropagation();
    event.preventDefault();
    document.removeEventListener('click', preventSingleHandler, true);
}
function preventNextClick() {
    document.addEventListener('click', preventSingleHandler, true);
}
function preventImmediateClick() {
    document.addEventListener('click', preventSingleHandler, true);
    // We want to only prevent click event that is already generated,
    // so we will remove the handler right after the current queue is
    // processed.
    setTimeout(removeClickBlocker, 0);
}
function removeClickBlocker() {
    document.removeEventListener('click', preventSingleHandler, true);
}


/***/ }),

/***/ "./dom-traversal.ts":
/*!**************************!*\
  !*** ./dom-traversal.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDomDepth": () => (/* binding */ getDomDepth),
/* harmony export */   "getItemFromContainerEvent": () => (/* binding */ getItemFromContainerEvent),
/* harmony export */   "getItemsInContainerEndIndex": () => (/* binding */ getItemsInContainerEndIndex),
/* harmony export */   "getItemsInContainerStartIndex": () => (/* binding */ getItemsInContainerStartIndex),
/* harmony export */   "hasContainerAncestor": () => (/* binding */ hasContainerAncestor)
/* harmony export */ });
/* harmony import */ var _expando__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./expando */ "./expando.ts");
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./state */ "./state.ts");


// Get elem's depth in the DOM tree.
// Note: no special handling for elements not attached to actual document.
function getDomDepth(elem) {
    let result = 0;
    for (elem = elem && elem.parentElement; elem; elem = elem.parentElement) {
        ++result;
    }
    return result;
}
// Get the first index for items that we consider for drag and drop
// end positioning. Skip anything with display: none.
function getItemsInContainerStartIndex(containerEl) {
    for (let i = 0; i < containerEl.children.length; ++i) {
        if (getComputedStyle(containerEl.children[i]).display !== 'none') {
            return i;
        }
    }
    // Nothing was found. That means that getItemsInContainerEnd() will also
    // find nothing and return 0, so let's return 0 for start/end consistency.
    return 0;
}
// Get the after-last index for items that we consider for drag and drop
// end positioning.
// Skip the temporary Omicron's elements at the end of the container,
// as well as anything with display: none.
function getItemsInContainerEndIndex(containerEl) {
    var _a;
    const floatEl = _state__WEBPACK_IMPORTED_MODULE_1__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_1__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_1__.dragState.floatEl;
    const placeholderEl = (_state__WEBPACK_IMPORTED_MODULE_1__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_1__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_1__.dragState.state) === _state__WEBPACK_IMPORTED_MODULE_1__.StateEnum.PendingDrag ? (_a = _state__WEBPACK_IMPORTED_MODULE_1__.dragState.to) === null || _a === void 0 ? void 0 : _a.placeholderEl : undefined;
    for (let i = containerEl.children.length - 1; i >= 0; --i) {
        const candidate = containerEl.children[i];
        if (candidate !== floatEl &&
            candidate !== placeholderEl &&
            getComputedStyle(candidate).display !== 'none') {
            // i is the index of last actual element, so the end index is i+1.
            return i + 1;
        }
    }
    return 0;
}
function getItemFromContainerEvent(event, options) {
    var _a;
    let containerEl = event.currentTarget;
    let result = null;
    let handleFound = false;
    for (let el = event.target; el !== containerEl; el = el.parentElement) {
        if (options.filterSelector && el.matches(options.filterSelector)) {
            return null;
        }
        if (options.handleSelector && el.matches(options.handleSelector)) {
            handleFound = true;
        }
        result = el;
    }
    // Returns null if the event is directly on the container,
    // or the element was filtered out for any reason.
    if (result &&
        ((_state__WEBPACK_IMPORTED_MODULE_1__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_1__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_1__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_1__.StateEnum.PendingDrag || result !== ((_a = _state__WEBPACK_IMPORTED_MODULE_1__.dragState.to) === null || _a === void 0 ? void 0 : _a.placeholderEl)) &&
        (!options.draggableSelector || result.matches(options.draggableSelector)) &&
        (handleFound || !options.handleSelector))
        return result;
    else {
        return null;
    }
}
function hasContainerAncestor(element) {
    for (let el = element.parentElement; el; el = el.parentElement) {
        if (_expando__WEBPACK_IMPORTED_MODULE_0__.expando in el) {
            return true;
        }
    }
    return false;
}


/***/ }),

/***/ "./event-utils.ts":
/*!************************!*\
  !*** ./event-utils.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cancelIfCancellable": () => (/* binding */ cancelIfCancellable),
/* harmony export */   "cancelIfOmicronActive": () => (/* binding */ cancelIfOmicronActive),
/* harmony export */   "toggleListeners": () => (/* binding */ toggleListeners)
/* harmony export */ });
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./state */ "./state.ts");

function cancelIfOmicronActive(event) {
    if (!_state__WEBPACK_IMPORTED_MODULE_0__.dragState || (_state__WEBPACK_IMPORTED_MODULE_0__.dragState.touchDrag && _state__WEBPACK_IMPORTED_MODULE_0__.dragState.state === _state__WEBPACK_IMPORTED_MODULE_0__.StateEnum.PreDrag)) {
        return;
    }
    if (event.cancelable) {
        event.preventDefault();
    }
}
function cancelIfCancellable(event) {
    if (event.cancelable) {
        event.preventDefault();
    }
}
const eventListenerOptionsArg = { passive: false, capture: false };
function toggleListeners(toggleOn, element, eventHandlerPairs) {
    const toggle = toggleOn ? HTMLElement.prototype.addEventListener : HTMLElement.prototype.removeEventListener;
    for (const [eventName, handler] of eventHandlerPairs) {
        toggle.call(element, eventName, handler, eventListenerOptionsArg);
    }
}


/***/ }),

/***/ "./expando.ts":
/*!********************!*\
  !*** ./expando.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "expando": () => (/* binding */ expando)
/* harmony export */ });
const expando = '__omicronDragAndDropData__';


/***/ }),

/***/ "./external-types.ts":
/*!***************************!*\
  !*** ./external-types.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DragKind": () => (/* binding */ DragKind)
/* harmony export */ });
// These are types that user interacts with directly.
var DragKind;
(function (DragKind) {
    DragKind[DragKind["Move"] = 0] = "Move";
    DragKind[DragKind["Copy"] = 1] = "Copy";
})(DragKind || (DragKind = {}));


/***/ }),

/***/ "./forbidden-indices.ts":
/*!******************************!*\
  !*** ./forbidden-indices.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ForbiddenIndices": () => (/* binding */ ForbiddenIndices)
/* harmony export */ });
/* harmony import */ var _expando__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./expando */ "./expando.ts");

class ForbiddenIndices {
    constructor() {
        this.forbiddenInsertionIndicesCache = new Map();
    }
    isForbiddenIndex(containerEl, pickedEl, insertionIndex) {
        return this.getForbiddenInsertionIndices(containerEl, pickedEl).has(insertionIndex);
    }
    getForbiddenInsertionIndices(containerEl, pickedEl) {
        let cachedValue = this.forbiddenInsertionIndicesCache.get(containerEl);
        if (cachedValue) {
            return cachedValue;
        }
        const fn = containerEl[_expando__WEBPACK_IMPORTED_MODULE_0__.expando].options.forbiddenInsertionIndicesFn;
        let newValue;
        if (typeof fn === 'function') {
            newValue = new Set(fn(containerEl, pickedEl));
        }
        else {
            newValue = new Set();
        }
        this.forbiddenInsertionIndicesCache.set(containerEl, newValue);
        return newValue;
    }
}


/***/ }),

/***/ "./hover-tracker.ts":
/*!**************************!*\
  !*** ./hover-tracker.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "containerHoverEntered": () => (/* binding */ containerHoverEntered),
/* harmony export */   "containerHoverLeft": () => (/* binding */ containerHoverLeft),
/* harmony export */   "getHoverContainersDeeperThan": () => (/* binding */ getHoverContainersDeeperThan),
/* harmony export */   "hoverContainersByDepth": () => (/* binding */ hoverContainersByDepth)
/* harmony export */ });
/* harmony import */ var _dom_traversal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dom-traversal */ "./dom-traversal.ts");

// List of containerData for all the initialized container elements
// currently under the pointer, at all times (i.e. not only when the drag
// is active).
// Updated with pointerenter/pointerleave events.
// Sorted from the deepest to most shallow in the DOM tree.
const hoverContainersByDepth = [];
function getHoverContainersDeeperThan(domDepth) {
    return hoverContainersByDepth.filter((container) => container.domDepth > domDepth);
}
function containerHoverEntered(containerData) {
    containerData.domDepth = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_0__.getDomDepth)(containerData.el);
    if (hoverContainersByDepth.indexOf(containerData) === -1) {
        hoverContainersByDepth.push(containerData);
        hoverContainersByDepth.sort(cmpDomDepth);
    }
}
function containerHoverLeft(containerData) {
    let delIdx;
    if ((delIdx = hoverContainersByDepth.indexOf(containerData)) !== -1) {
        hoverContainersByDepth.splice(delIdx, 1);
    }
}
// Compare function for hoverContainersByDepth.
function cmpDomDepth(a, b) {
    return b.domDepth - a.domDepth;
}


/***/ }),

/***/ "./index-conversions.ts":
/*!******************************!*\
  !*** ./index-conversions.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "eventualIndexFromInsertionIndex": () => (/* binding */ eventualIndexFromInsertionIndex),
/* harmony export */   "insertionIndexFromEventualIndex": () => (/* binding */ insertionIndexFromEventualIndex)
/* harmony export */ });
/* harmony import */ var _external_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./external-types */ "./external-types.ts");
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./state */ "./state.ts");


// Insertion index is the index at which we will insert the item.
// Eventual index is the index at which the inserted item will end up.
// It works like this:
//   containerEl.insertBefore(insertedItem, containerEl.children[insertionIndex])
//   const eventualIndex = Array.from(containerEl.children).indexOf(insertedItem))
//
// This means that eventualIndex is usually the same as insertionIndex,
// but there is a discrepancy when we are:
//   a) moving the item (as opposed to copying it),
//   b) inside a single container (as opposed to moving/copying to another container),
//   c) and the insertionIndex is greater than the index before move
//           (i.e. moving element further/down inside the container),
// in which case eventualIndex is insertionIndex - 1.
function insertionIndexFromEventualIndex(containerEl, eventualIndex) {
    if (_state__WEBPACK_IMPORTED_MODULE_1__.dragState && containerEl === _state__WEBPACK_IMPORTED_MODULE_1__.dragState.from.containerEl && _state__WEBPACK_IMPORTED_MODULE_1__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_0__.DragKind.Move && eventualIndex > _state__WEBPACK_IMPORTED_MODULE_1__.dragState.from.index) {
        return eventualIndex + 1;
    }
    // Note: in case where nothing changes (we "move" item into the place it
    // already is at) there are 2 possible values for insertionIndex - both
    // dragState.from.index and dragState.from.index + 1 have that result.
    // We return dragState.from.index in that case, but that is arbitrary.
    return eventualIndex;
}
function eventualIndexFromInsertionIndex(containerEl, insertionIndex) {
    if (_state__WEBPACK_IMPORTED_MODULE_1__.dragState && containerEl === _state__WEBPACK_IMPORTED_MODULE_1__.dragState.from.containerEl && _state__WEBPACK_IMPORTED_MODULE_1__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_0__.DragKind.Move && insertionIndex > _state__WEBPACK_IMPORTED_MODULE_1__.dragState.from.index) {
        return insertionIndex - 1;
    }
    return insertionIndex;
}


/***/ }),

/***/ "./invisible-item.ts":
/*!***************************!*\
  !*** ./invisible-item.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cancelInvisible": () => (/* binding */ cancelInvisible),
/* harmony export */   "makeInvisible": () => (/* binding */ makeInvisible)
/* harmony export */ });
function makeInvisible(elem) {
    // Theoretically some descendants can have visibility set explicitly
    // to visible and then whey would be visible anyway, so let's double
    // down with opacity: 0;
    elem.style.visibility = 'hidden';
    elem.style.opacity = '0';
    elem.style.pointerEvents = 'none';
    elem.classList.add('drag-active-item');
}
function cancelInvisible(elem) {
    // Note: if there were any inline styles on the element, uh, we have
    // just erased them. I think that is resonable to force users to just
    // deal with it.
    elem.classList.remove('drag-active-item');
    elem.style.visibility = '';
    elem.style.opacity = '';
    elem.style.pointerEvents = '';
}


/***/ }),

/***/ "./options.ts":
/*!********************!*\
  !*** ./options.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ContainerOptions": () => (/* binding */ ContainerOptions)
/* harmony export */ });
/* harmony import */ var _external_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./external-types */ "./external-types.ts");

// Options for an Omicron container.
// Actual options for a container are stored in
// containerEl[expando].options.
class ContainerOptions {
    constructor() {
        // CSS selector for draggable children of the container. The selector
        // is evaluated on pointerdown on the pressed item.
        // When left undefined, all elements in the container are draggable.
        // When the matcher fails, the pointerdown event is allowed to bubble,
        // otherwise the stopPropagation is called.
        // FUTURE COMPAT: At the moment, when the matcher fails, the pointerdown
        // event is allowed to bubble further (allowing e.g. an ancestor of the
        // container to be dragged). An option to control this behavior can be
        // added in the future.
        this.draggableSelector = null;
        // CSS selector for elements that can't be used to drag an item.
        // If any DOM element on the path from event.target (of pointerdown event)
        // to the candidate item matches this selector, the drag is not considered.
        // When the filter matcher hits any element on the path, the pointerdown
        // event is allowed to bubble, otherwise the stopPropagation is called.
        // FUTURE COMPAT: Options to control the bubbling behavior may be added,
        // similar as for draggableSelector.
        this.filterSelector = null;
        // CSS selector for handle element. If a handle selector is defined,
        // an item can be dragged only when grabbed by a handle-matching child
        // (or must be a handle itself).
        // If handleSelector is defined, and no element on the path from
        // event.target to the item match handleSelector, the behavior is the same
        // as if draggableSelector didn't match (draggableSelector itself must
        // match anyway).
        // FUTURE COMPAT: Options to control the bubbling behavior may be added,
        // similar as for draggableSelector.
        this.handleSelector = null;
        this.allowPull = _external_types__WEBPACK_IMPORTED_MODULE_0__.DragKind.Move;
        this.allowDrop = true;
        // Minimal (euclidean, px) distance the pointer needs to move from the initial
        // position to trigger the drag before delay ends. Not applied for touch drag.
        this.minimalMoveMouse = 5;
        // Exact length of the preDrag phase for touch, and maximal for other pointers.
        // For touch, this is a minimal time between pointerdown and the first touchmove
        // to start the drag. If a touchmove/touchend/touchcancel happens earlier,
        // the drag is cancelled, otherwise the drag starts `delay` ms after the initial
        // pointerdown event.
        // For mouse/pen, the drag starts _at the latest_ `delay` ms after the initial
        // pointerdown, unless the pointer is released (pointerup). The drag can start
        // earlier, if the pointer moves minimalMoveMouse px or more from initial point.
        this.delay = 220;
        // Enter guards define the area of the container that may be used to drag
        // elements into it. After the container was entered (became toEl) the whole
        // area can be used to drag the item inside the container.
        // The guards define two margins, from the left end right edges of
        // the container that are excluded from this drag-accepting area.
        // This is useful when creating nested containers, to make it easier
        // to reorder "big" elements in the "big" parent container, without
        // accidentally entering the "small" child container.
        // Guards without suffix are a rate of width, those with 'px' are in pixels.
        this.enterGuardLeft = 0;
        this.enterGuardLeftPx = 0;
        this.enterGuardRight = 0;
        this.enterGuardRightPx = 0;
        // forbiddenInsertionIndicesFn can be used to make some indices invalid
        // as newIndex.
        // When entering new container (as toEl), forbiddenInsertionIndicesFn
        // defined _for that entered container_ is evaluated. The forbidden
        // indices are skipped when considering moves inside the toEl.
        // forbiddenInsertionIndicesFn will be called once per container during
        // each drag, and the result will be cached.
        this.forbiddenInsertionIndicesFn = null;
        // createFloatElemFn: null,
        // Scale factor of floatEl transform. Can be used to make the dragged
        // element slightly smaller. The transform-origin for the scale is set
        // where the pointer is located on the original element.
        this.floatElScale = 1;
        // Chrome on Android will highlight every element that you tap with mild
        // blue color. That is irrelevant and distracting when using drag and drop,
        // so we turn this off by default, but you can disable that feature.
        this.setWebkitTapHighlightColorTransparent = true;
        // Argument to pass to navigator.vibrate when the drag is activated.
        // Set to 0 to disable.
        // The value is the length of vibration in milliseconds (it may be also
        // a pattern, but it really doesn't make sense with drag and drop).
        this.dragStartVibration = 25;
        // onBeforePreDrag: Called just before preDrag starts.
        // Return explicit `false` to cancel the drag.
        // Return DragKind to override the allowPull behavior for this particular
        // drag.
        this.onBeforePreDrag = null;
        // The element was chosen and the wait starts for the delay or minimal mouse
        // move to start dragging. The return value is ignored.
        // onPreDragStart(containerEl, activeEl, event)
        this.onPreDragStart = null;
        // Called just after the conditions for the drag start are met, but before
        // any styling (transforms) for the drag started, before placeholder
        // and floatEl are created. The return value is ignored.
        this.onBeforeDragStart = null;
        // The floatEl to be placed under the pointer was created. You can edit its
        // internal DOM structure.
        // Use it to remove or override any "pointer-events: all" rules you might
        // have created inside the element, as they will break the drag logic.
        this.onFloatElementCreated = null;
        // The element is actually being dragged now. The return value is ignored.
        this.onDragStart = null;
        // The container became toEl. This will fire right after onDragStart
        // for the fromEl (being also toEl) and then for every entered container.
        this.onContainerEntered = null;
        // The container is no longer toEl. This will fire at the end of
        // the drag, too, before the drag finish events.
        this.onContainerLeft = null;
        // The same event format is shared between onInternalChange,
        // onDropToOtherContainer, onDropFromOtherContainer.
        // Called on change where toEl === fromEl.
        this.onInternalChange = null;
        // Called on fromEl when toEl !== fromEl.
        this.onDropToOtherContainer = null;
        // Called on toEl when toEl !== fromEl.
        this.onDropFromOtherContainer = null;
        // The drag or pre-drag was finished. In case it was a sucessful drag,
        // called after relevant onInternalChange/onDrop callback, with the same
        // event.
        // onDragFinished(dragEndEvent)
        this.onDragFinished = null;
    }
}
;


/***/ }),

/***/ "./overscroll-behavior.ts":
/*!********************************!*\
  !*** ./overscroll-behavior.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disableOverscrollBehavior": () => (/* binding */ disableOverscrollBehavior),
/* harmony export */   "revertOverscrollBehavior": () => (/* binding */ revertOverscrollBehavior)
/* harmony export */ });
let saved;
function disableOverscrollBehavior() {
    if (saved)
        return;
    // Prevent the scroll-to-refresh behavior and the effect
    // of bumping into the scroll end on mobile.
    saved = {
        htmlOvescrollBehavior: document.documentElement.style.overscrollBehavior,
        bodyOvescrollBehavior: document.body.style.overscrollBehavior,
    };
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
}
function revertOverscrollBehavior() {
    if (!saved)
        return;
    document.documentElement.style.overscrollBehavior = saved.htmlOvescrollBehavior;
    document.body.style.overscrollBehavior = saved.bodyOvescrollBehavior;
    saved = null;
}


/***/ }),

/***/ "./scrollers.ts":
/*!**********************!*\
  !*** ./scrollers.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "updateActiveScrollers": () => (/* binding */ updateActiveScrollers),
/* harmony export */   "updateScrollers": () => (/* binding */ updateScrollers)
/* harmony export */ });
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./state */ "./state.ts");

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.
let scrollers = [];
let activeScrollers = [];
// Last timestamp (as passed to requestAnimationFrame callback) when
// active scrollers animation/scroll positions were updated.
// This is the base for calculating the scroll distance for the current frame.
// Always null if activeScrollers array is empty.
let lastScrollAnimationTimestamp = null;
function collectScrollers(elem) {
    let result = [];
    // TODO: Include document.scrollingElement
    for (; elem; elem = elem.parentElement) {
        let style = getComputedStyle(elem);
        let horizontalScroll = style.overflowX === 'auto' || style.overflowX === 'scroll';
        let verticalScroll = style.overflowY === 'auto' || style.overflowY === 'scroll';
        if (!horizontalScroll && !verticalScroll) {
            continue;
        }
        let domRect = elem.getClientRects()[0];
        // Create our own structure. Origina DOMRect is read-only, and
        // we want to be able to make updates.
        let rect = {
            left: domRect.left,
            top: domRect.top,
            right: domRect.right,
            bottom: domRect.bottom,
        };
        result.push({
            el: elem,
            rect,
            horizontal: horizontalScroll,
            vertical: verticalScroll,
            snap: Boolean(elem.dataset.omicronScrollSnap),
            snapCooldown: false,
        });
    }
    return result;
}
// This is a helper for updateActiveScrollers, only to be called from there.
function activateScroller(scroller, horizontal, vertical, speedInput) {
    if (scroller.snap) {
        if (!scroller.snapCooldown) {
            if (horizontal) {
                scroller.el.scrollLeft += horizontal * scroller.el.clientWidth;
            }
            if (vertical) {
                scroller.el.scrollTop += vertical * scroller.el.clientHeight;
            }
            scroller.snapCooldown = true; // Prevent immediate re-activation.
        }
        // TODO: Either force recomputing the rects for other scrollers after
        // the scroll, or maybe just give up caching the rects.
    }
    else {
        activeScrollers.push({
            scrollerIndex: scrollers.indexOf(scroller),
            scrollerEl: scroller.el,
            horizontal,
            vertical,
            speedInput,
        });
    }
}
const minScrollSpeed = 0.3; // In pixels per millisecond.
const maxScrollSpeed = 0.7; // In pixels per millisecond.
const maxScrollSpeedIncrease = maxScrollSpeed - minScrollSpeed;
function animationFrame(timestamp) {
    animFrameRequestId = 0; // Allow scheduling for the next frame.
    if (activeScrollers.length === 0) {
        return;
    }
    if (lastScrollAnimationTimestamp) {
        let frameTime = timestamp - lastScrollAnimationTimestamp;
        // Animate. If lastScrollAnimationTimestamp is not set, the animation
        // will start on the next frame.
        for (let s of activeScrollers) {
            // Notice the difference between entries in activeScrollers and
            // scrollers arrays, they are different.
            const scrollSpeed = minScrollSpeed + s.speedInput * maxScrollSpeedIncrease;
            if (s.vertical) {
                const oldValue = s.scrollerEl.scrollTop;
                const diff = s.vertical * scrollSpeed * frameTime;
                s.scrollerEl.scrollTop += diff;
                const actualDiff = s.scrollerEl.scrollTop - oldValue;
                if (actualDiff !== 0) {
                    updateScrollerRects(s.scrollerIndex, actualDiff, 0);
                }
            }
            if (s.horizontal) {
                const oldValue = s.scrollerEl.scrollLeft;
                const diff = s.horizontal * scrollSpeed * frameTime;
                s.scrollerEl.scrollLeft += diff;
                const actualDiff = s.scrollerEl.scrollLeft - oldValue;
                if (actualDiff !== 0) {
                    updateScrollerRects(s.scrollerIndex, 0, actualDiff);
                }
            }
        }
    }
    lastScrollAnimationTimestamp = timestamp;
    animFrameRequestId = requestAnimationFrame(animationFrame);
}
function updateScrollerRects(updateBefore, vDiff, hDiff) {
    for (let i = 0; i < updateBefore; ++i) {
        const rect = scrollers[i].rect;
        rect.top -= vDiff;
        rect.bottom -= vDiff;
        rect.left -= hDiff;
        rect.right -= hDiff;
    }
}
// Call this when active container changes.
function updateScrollers(elem) {
    scrollers = collectScrollers(elem);
}
const scrollActivationMargin = 60; // In pixels. TODO: Allow adjusting with element markup.
// Call this when mouse moves.
function updateActiveScrollers() {
    // TODO: Remove array allocation?
    activeScrollers = [];
    if (!_state__WEBPACK_IMPORTED_MODULE_0__.dragState) {
        lastScrollAnimationTimestamp = null;
        return;
    }
    const xLast = _state__WEBPACK_IMPORTED_MODULE_0__.dragState.currentPointerPos.x;
    const yLast = _state__WEBPACK_IMPORTED_MODULE_0__.dragState.currentPointerPos.y;
    for (let scroller of scrollers) {
        if (scroller.horizontal) {
            if (xLast < scroller.rect.left + scrollActivationMargin) {
                // Scrolling left.
                activateScroller(scroller, -1, 0, (scroller.rect.left + scrollActivationMargin - xLast) / scrollActivationMargin);
            }
            else if (xLast > scroller.rect.right - scrollActivationMargin) {
                // Scrolling right.
                activateScroller(scroller, 1, 0, (xLast - scroller.rect.right + scrollActivationMargin) / scrollActivationMargin);
            }
            else {
                scroller.snapCooldown = false;
            }
        }
        if (scroller.vertical) {
            if (yLast < scroller.rect.top + scrollActivationMargin) {
                // Scrolling up.
                activateScroller(scroller, 0, -1, (scroller.rect.top + scrollActivationMargin - yLast) / scrollActivationMargin);
            }
            else if (yLast > scroller.rect.bottom - scrollActivationMargin) {
                // Scrolling down.
                activateScroller(scroller, 0, 1, (yLast - scroller.rect.bottom + scrollActivationMargin) / scrollActivationMargin);
            }
        }
    }
    if (activeScrollers.length === 0) {
        // Not animating (any more). Let the next animation know that it needs
        // to count itself in, in case we didn't request previous frames.
        lastScrollAnimationTimestamp = null;
    }
    else {
        // Request animation for the active scrollers.
        if (!animFrameRequestId) {
            animFrameRequestId = requestAnimationFrame(animationFrame);
        }
    }
}


/***/ }),

/***/ "./selection-control.ts":
/*!******************************!*\
  !*** ./selection-control.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disableUserSelectOnBody": () => (/* binding */ disableUserSelectOnBody),
/* harmony export */   "revertUserSelectOnBody": () => (/* binding */ revertUserSelectOnBody)
/* harmony export */ });
let saved;
function disableUserSelectOnBody() {
    if (saved)
        return;
    saved = {
        bodyUserSelect: document.body.style.userSelect,
        bodyWebkitUserSelect: document.body.style.webkitUserSelect,
        bodyWebkitTouchCallout: document.body.style.webkitTouchCallout,
    };
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.webkitTouchCallout = 'none';
}
function revertUserSelectOnBody() {
    if (!saved)
        return;
    document.body.style.userSelect = saved.bodyUserSelect;
    document.body.style.webkitUserSelect = saved.bodyWebkitUserSelect;
    document.body.style.webkitTouchCallout = saved.bodyWebkitTouchCallout;
    saved = null;
}


/***/ }),

/***/ "./state.ts":
/*!******************!*\
  !*** ./state.ts ***!
  \******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BadStateError": () => (/* binding */ BadStateError),
/* harmony export */   "StateEnum": () => (/* binding */ StateEnum),
/* harmony export */   "dragState": () => (/* binding */ dragState),
/* harmony export */   "isAfterDrag": () => (/* binding */ isAfterDrag),
/* harmony export */   "isPendingDrag": () => (/* binding */ isPendingDrag),
/* harmony export */   "isPreDrag": () => (/* binding */ isPreDrag),
/* harmony export */   "setDragState": () => (/* binding */ setDragState)
/* harmony export */ });
var StateEnum;
(function (StateEnum) {
    StateEnum[StateEnum["PreDrag"] = 0] = "PreDrag";
    StateEnum[StateEnum["PendingDrag"] = 1] = "PendingDrag";
    StateEnum[StateEnum["AfterDrag"] = 2] = "AfterDrag";
})(StateEnum || (StateEnum = {}));
// Perhaps it would be better to write these assertions inline, and let
// Typescript figure out that they are, indeed, correct.
function isPreDrag(state) {
    return !!state && state.state === StateEnum.PreDrag;
}
function isPendingDrag(state) {
    return !!state && state.state === StateEnum.PendingDrag;
}
function isAfterDrag(state) {
    return !!state && state.state === StateEnum.AfterDrag;
}
class BadStateError extends Error {
    constructor(expectedState) {
        super(`Drag state assertion failed: expected state ${StateEnum[expectedState]}, but actual is ${dragState ? StateEnum[dragState.state] : '<no drag>'}`);
    }
}
let dragState = null;
function setDragState(newDragState) {
    // TODO: Some logic might happen here, like changing the listeners, perhaps.
    dragState = newDragState;
}


/***/ }),

/***/ "./update-float-el-on-next-frame.ts":
/*!******************************************!*\
  !*** ./update-float-el-on-next-frame.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "updateFloatElOnNextFrame": () => (/* binding */ updateFloatElOnNextFrame)
/* harmony export */ });
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./state */ "./state.ts");

// Id returned by requestAnimationFrame. Always reset to 0 when no frame is
// requested.
let animFrameRequestId = 0; // 0 is never used as actual id.
function animationFrame(timestamp) {
    animFrameRequestId = 0; // Allow scheduling for the next frame.
    if (_state__WEBPACK_IMPORTED_MODULE_0__.dragState && _state__WEBPACK_IMPORTED_MODULE_0__.dragState.state === _state__WEBPACK_IMPORTED_MODULE_0__.StateEnum.PendingDrag) {
        // TODO: adjust for scroll or other changes of the base.
        _state__WEBPACK_IMPORTED_MODULE_0__.dragState.floatEl.style.transform = `translate(${_state__WEBPACK_IMPORTED_MODULE_0__.dragState.floatElPos.x}px,${_state__WEBPACK_IMPORTED_MODULE_0__.dragState.floatElPos.y}px) scale(${_state__WEBPACK_IMPORTED_MODULE_0__.dragState.floatElScale})`;
    }
}
function updateFloatElOnNextFrame() {
    if (!animFrameRequestId) {
        animFrameRequestId = requestAnimationFrame(animationFrame);
    }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./omicron-main.ts ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _animate_move__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./animate-move */ "./animate-move.ts");
/* harmony import */ var _anims__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./anims */ "./anims.ts");
/* harmony import */ var _click_blocker__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./click-blocker */ "./click-blocker.ts");
/* harmony import */ var _dom_traversal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./dom-traversal */ "./dom-traversal.ts");
/* harmony import */ var _event_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./event-utils */ "./event-utils.ts");
/* harmony import */ var _expando__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./expando */ "./expando.ts");
/* harmony import */ var _external_types__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./external-types */ "./external-types.ts");
/* harmony import */ var _forbidden_indices__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./forbidden-indices */ "./forbidden-indices.ts");
/* harmony import */ var _hover_tracker__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./hover-tracker */ "./hover-tracker.ts");
/* harmony import */ var _index_conversions__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./index-conversions */ "./index-conversions.ts");
/* harmony import */ var _invisible_item__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./invisible-item */ "./invisible-item.ts");
/* harmony import */ var _options__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./options */ "./options.ts");
/* harmony import */ var _overscroll_behavior__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./overscroll-behavior */ "./overscroll-behavior.ts");
/* harmony import */ var _scrollers__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./scrollers */ "./scrollers.ts");
/* harmony import */ var _selection_control__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./selection-control */ "./selection-control.ts");
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./state */ "./state.ts");
/* harmony import */ var _update_float_el_on_next_frame__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./update-float-el-on-next-frame */ "./update-float-el-on-next-frame.ts");

















function initDragContainer(container, options) {
    if (container[_expando__WEBPACK_IMPORTED_MODULE_5__.expando]) {
        return; // Ignore repeated calls.
    }
    const containerEl = Object.assign(container, {
        [_expando__WEBPACK_IMPORTED_MODULE_5__.expando]: {
            el: container,
            options: Object.assign(new _options__WEBPACK_IMPORTED_MODULE_11__.ContainerOptions(), options || {}),
            domDepth: 0, // To be updated dynamically when added to hoverContainers.
        },
    });
    (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(true, document, [
        ['dragover', _event_utils__WEBPACK_IMPORTED_MODULE_4__.cancelIfOmicronActive],
        ['touchmove', _event_utils__WEBPACK_IMPORTED_MODULE_4__.cancelIfOmicronActive],
    ]);
    (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(true, containerEl, [
        ['pointerdown', anyState_container_PointerDown],
        ['pointerenter', anyState_container_PointerEnter],
        ['pointerleave', anyState_container_PointerLeave],
    ]);
    if (containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options.setWebkitTapHighlightColorTransparent &&
        ('webkitTapHighlightColor' in containerEl.style)) {
        containerEl.style.webkitTapHighlightColor = 'transparent';
    }
    if (getComputedStyle(containerEl).position === 'static') {
        // The container needs to be positioned to work correctly
        // with absolutely positioned placeholder.
        containerEl.style.position = 'relative';
    }
}
function toggleEvents_statePreDrag(toggleOn, touchDrag) {
    if (touchDrag) {
        (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(toggleOn, document, [
            ['touchstart', statePreDrag_window_TouchStart],
            ['touchmove', statePreDrag_window_TouchMove],
            ['touchend', statePreDrag_window_TouchEndOrCancel],
            ['touchcancel', statePreDrag_window_TouchEndOrCancel],
            ['pointermove', _event_utils__WEBPACK_IMPORTED_MODULE_4__.cancelIfCancellable],
        ]);
    }
    else {
        (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(toggleOn, document, [
            ['pointermove', statePreDrag_window_PointerMove],
            ['pointerup', statePreDrag_window_PointerUpOrCancel],
            ['pointercancel', statePreDrag_window_PointerUpOrCancel],
        ]);
    }
}
function toggleEvents_stateDrag(toggleOn, touchDrag) {
    if (touchDrag) {
        (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(toggleOn, document, [
            // For preventing multi-touch while dragging.
            ['touchstart', stateDrag_window_TouchStart],
            // We need to capture touchmove events in order to call
            // .preventDefault() on them and stop the scrolling.
            // Calling .preventDefault() on PointerEvents doesn't do that.
            ['touchmove', stateDrag_window_TouchMove],
            ['touchend', stateDrag_window_TouchEnd],
            ['touchcancel', stateDrag_window_TouchCancel],
            ['pointermove', _event_utils__WEBPACK_IMPORTED_MODULE_4__.cancelIfCancellable],
        ]);
    }
    else {
        (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(toggleOn, document, [
            ['pointermove', stateDrag_window_PointerMove],
            ['pointerup', stateDrag_window_PointerUp],
            ['pointercancel', stateDrag_window_PointerCancel],
        ]);
    }
    (0,_event_utils__WEBPACK_IMPORTED_MODULE_4__.toggleListeners)(toggleOn, document, [
        ['selectstart', _event_utils__WEBPACK_IMPORTED_MODULE_4__.cancelIfCancellable],
    ]);
}
function anyState_container_PointerDown(event) {
    // Unconditionally release pointer capture. I do that before any checks
    // for pending drag to avoid unnecessary races with touchstart.
    const containerEl = event.currentTarget;
    if (!(0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.hasContainerAncestor)(containerEl)) {
        // Only let the event propagate if there are other containers below,
        // but don't let it go outside.
        event.stopPropagation();
    }
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState) {
        return;
    }
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
        // When using mouse, allow only the main button.
        // event.button on PointerEvent unfortunately doesn't work,
        // but event.buttons does.
        // TODO: We should probably check the button number for
        // pointerType === 'pointer' as well, just not for touch.
        return;
    }
    const touchDrag = (event.pointerType === 'touch');
    const containerData = containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando];
    const containerOptions = containerData.options;
    if (containerOptions.allowPull === false) {
        // Starting drag in this container is not allowed at all.
        return;
    }
    let dragKind = containerOptions.allowPull;
    const pickedEl = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemFromContainerEvent)(event, containerData.options);
    if (!pickedEl) {
        // TODO: Add an option to .stopPropagation() here as well, to prevent
        // dragging the container by elements, event if not by the handle?
        return;
    }
    // Allow the callback to cancel the preDrag before it starts.
    // This can be used to implement some dynamic barrier on top of
    // draggableSelector, filterSelector, and handleSelector.
    if (typeof containerOptions.onBeforePreDrag === 'function') {
        const ret = containerOptions.onBeforePreDrag(containerEl, pickedEl, event);
        switch (ret) {
            case false:
                // Cancel drag.
                return;
            case _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move:
            case _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Copy:
                // Override drag kind.
                dragKind = ret;
                break;
            default:
                break;
        }
    }
    // Only stop propagation to ancestor containers after deciding that
    // something was indeed grabbed.
    // That allows the nested container to be dragged by contents when using
    // handle/filter, or just being grabbed by the padding/empty area.
    event.stopPropagation();
    const from = {
        containerEl,
        index: Array.from(containerEl.children).indexOf(pickedEl),
    };
    toggleEvents_statePreDrag(true, touchDrag);
    const initialPickupRect = pickedEl.getClientRects()[0];
    const pickupPointerPos = {
        x: event.clientX,
        y: event.clientY,
    };
    // I add some arbitrary difference to give the effect of the element
    // snapping out of place, instead of just staying in place silently.
    const floatFromPointerOffset = {
        x: initialPickupRect.x - pickupPointerPos.x + 16,
        y: initialPickupRect.y - pickupPointerPos.y - 4,
    };
    // We are entering statePreDrag. We will start the drag after a delay, or if
    // the mouse moves sufficiently far. We will cancel the drag if the touch
    // moves too far before the delay.
    // IMPORTANT: Some logic depends on startDrag being called asynchronously,
    // so even if the delay is 0, setTimeout should still be used.
    const delay = containerOptions.delay;
    const preDragTimeoutId = setTimeout(startDrag, delay);
    if (typeof containerOptions.onPreDragStart === 'function') {
        containerOptions.onPreDragStart(containerEl, pickedEl, event);
    }
    (0,_selection_control__WEBPACK_IMPORTED_MODULE_14__.disableUserSelectOnBody)();
    // Ensure the element has pointer capture. This happens automatically
    // for touch, but not for mouse.
    // Pointer capture is important to avoid calls to enterContainer
    // and leaveContainer during preDrag - these would mess up the drag
    // setup WRT toEl. The capture will be released afterwards, allowing
    // immediate execution of leaveContainer/enterContainer if necessary.
    const pointerDownTarget = event.target;
    pointerDownTarget.setPointerCapture(event.pointerId);
    (0,_state__WEBPACK_IMPORTED_MODULE_15__.setDragState)({
        state: _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag,
        pointerId: event.pointerId,
        pointerDownTarget,
        touchDrag,
        from,
        dragKind,
        pickedEl,
        initialPickupRect,
        pickupPointerPos,
        floatFromPointerOffset,
        currentPointerPos: pickupPointerPos,
        floatElScale: containerOptions.floatElScale,
        minimalMoveMouse: containerOptions.minimalMoveMouse,
        forbiddenIndices: new _forbidden_indices__WEBPACK_IMPORTED_MODULE_7__.ForbiddenIndices(),
        preDragTimeoutId,
    });
}
function startDrag() {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag);
    // In case this was triggered by mouse, and not by the timeout itsef, we
    // cancel the timeout.
    clearTimeout(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.preDragTimeoutId);
    let containerData = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando];
    const containerOptions = containerData.options;
    if (typeof containerOptions.onBeforeDragStart === 'function') {
        containerOptions.onBeforeDragStart(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
    // Should we go over the whole activeEl subtree and mark the containers there
    // as inactive? We may need to, actually.
    toggleEvents_stateDrag(true, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.touchDrag);
    toggleEvents_statePreDrag(false, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.touchDrag);
    // Release default pointer capture. This is important that it happens only
    // after dragStart, and that we keep the capture during preDrag - that saves
    // us from some subtle race conditions. See issue #11 for context.
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerDownTarget) {
        // Pointermove events are by default all captured by the pointerdown's target.
        // That means no pointerenter/pointerleave events, that we rely on, so
        // we need to release the pointer capture.
        // Source: https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerDownTarget.releasePointerCapture(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerId);
    }
    (0,_overscroll_behavior__WEBPACK_IMPORTED_MODULE_12__.disableOverscrollBehavior)();
    const floatEl = createFloatEl(_state__WEBPACK_IMPORTED_MODULE_15__.dragState);
    if (typeof containerOptions.onFloatElementCreated === 'function') {
        containerOptions.onFloatElementCreated(floatEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move) {
        (0,_invisible_item__WEBPACK_IMPORTED_MODULE_10__.makeInvisible)(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
        // Schedule animation of moving pickedEl out of the container. In practice,
        // We will almost always override it with another animation of "insertion",
        // but sometimes it may happen that we actually leave the original container
        // immediately.
        (0,_animate_move__WEBPACK_IMPORTED_MODULE_0__.animateMoveInsideContainer)(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index, (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerEndIndex)(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl));
    }
    if (typeof containerOptions.onDragStart === 'function') {
        containerOptions.onDragStart(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
    if (navigator.vibrate && containerData.options.dragStartVibration) {
        // Unfortunately doesn't work if this drag is the first user interaction
        // with the page. This is due to Chrome being a little bit too strict
        // in requiring previous user interaction with the page before
        // activating Vibration API.
        // See https://stackoverflow.com/a/46189638/2468549.
        navigator.vibrate(containerData.options.dragStartVibration);
    }
    (0,_state__WEBPACK_IMPORTED_MODULE_15__.setDragState)(Object.assign(Object.assign({}, _state__WEBPACK_IMPORTED_MODULE_15__.dragState), { state: _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag, floatEl, floatElPos: {
            x: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x + _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatFromPointerOffset.x,
            y: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y + _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatFromPointerOffset.y,
        } }));
    // Synthethic update, to determine the insertion point.
    // TODO: We might need to give it a hint that this is a drag start, after all.
    updateOnMove({
        clientX: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x,
        clientY: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y,
    });
}
function statePreDrag_window_TouchStart(event) {
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState && event.touches.length !== 1) {
        // We don't allow multi-touch during drag.
        exitDrag(false);
    }
}
function statePreDrag_window_TouchMove(event) {
    // We may not be able to cancel the scroll any more after this event,
    // so we have to give up the drag.
    exitDrag(false);
}
function statePreDrag_window_TouchEndOrCancel(event) {
    exitDrag(false);
    // This is pre-drag and no move happened, so we allow the click,
    // hence no preventDefault() call here.
}
function statePreDrag_window_PointerMove(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag);
    if (event.pointerId !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerId) {
        return;
    }
    const newX = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x = event.clientX;
    const newY = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y = event.clientY;
    let xDiff = newX - _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickupPointerPos.x;
    let yDiff = newY - _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickupPointerPos.y;
    let distanceSquaredFromInitial = xDiff * xDiff + yDiff * yDiff;
    const minimalMoveMouse = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.minimalMoveMouse;
    if (distanceSquaredFromInitial > minimalMoveMouse * minimalMoveMouse) {
        startDrag();
    }
}
function statePreDrag_window_PointerUpOrCancel(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag);
    if (event.pointerId !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerId) {
        return;
    }
    exitDrag(false);
}
function stateDrag_window_TouchStart(event) {
    // We don't allow multi-touch during dragging.
    exitDrag(false);
}
function stateDrag_window_TouchMove(event) {
    if (event.cancelable) {
        // Prevent scroll.
        event.preventDefault();
    }
    const touch = event.touches.item(0);
    if (!touch || event.touches.length !== 1) {
        // We don't allow multi-touch during dragging.
        exitDrag(false);
        return;
    }
    handleMove(touch);
}
function stateDrag_window_PointerMove(event) {
    if (event.pointerId !== (_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerId)) {
        return;
    }
    handleMove(event);
}
// The direction of the last pointer move in y-coordinates.
// -1 when going up (lower y value), +1 when going down.
// The last value is kept as long as the y-coord doesn't change.
let yDirection = -1;
// This is to be called only when the pointer actually moves.
function handleMove(evtPoint) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    // Update the mouse position.
    if (evtPoint.clientY !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y) {
        yDirection = evtPoint.clientY > _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y ? 1 : -1;
    }
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x = evtPoint.clientX;
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y = evtPoint.clientY;
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatElPos.x =
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x + _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatFromPointerOffset.x;
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatElPos.y =
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.y + _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatFromPointerOffset.y;
    (0,_update_float_el_on_next_frame__WEBPACK_IMPORTED_MODULE_16__.updateFloatElOnNextFrame)();
    updateOnMove(evtPoint);
}
// This is to be called both when pointer moves, and to invoke synthetic update
// after scroll and on drag start.
function updateOnMove(evtPoint) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    // If we are hovering over some containers that are descendants
    // of toEl but we didn't enter them yet for any reason, let's reconsider.
    const toElDomDepth = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to ? _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].domDepth : -1;
    for (const hoverContainer of (0,_hover_tracker__WEBPACK_IMPORTED_MODULE_8__.getHoverContainersDeeperThan)(toElDomDepth)) {
        if (maybeEnterContainer(hoverContainer, evtPoint)) {
            // enterContainer took take care of handling the new position
            // and animation, so our work here is done.
            return;
        }
    }
    const to = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to;
    if (!to) {
        return;
    }
    (0,_scrollers__WEBPACK_IMPORTED_MODULE_13__.updateActiveScrollers)();
    let updatedEventualIndex = findUpdatedEventualIndex(to.containerEl, evtPoint);
    let updatedInsertionIndex = (0,_index_conversions__WEBPACK_IMPORTED_MODULE_9__.insertionIndexFromEventualIndex)(to.containerEl, updatedEventualIndex);
    if (updatedEventualIndex != to.insertionIndex && !_state__WEBPACK_IMPORTED_MODULE_15__.dragState.forbiddenIndices.isForbiddenIndex(to.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl, updatedInsertionIndex)) {
        let previousEventualIndex = to.eventualIndex;
        to.eventualIndex = updatedEventualIndex;
        to.insertionIndex = updatedInsertionIndex;
        (0,_animate_move__WEBPACK_IMPORTED_MODULE_0__.animateMoveInsideContainer)(to.containerEl, previousEventualIndex, updatedEventualIndex);
        updatePlaceholderAndNoMoveZone(to);
    }
}
// By default, we optimize the search by going only from the current index
// in the direction of mouseY, and only when the move is outside of
// precomputed zone where we know no move happened. When insertionContainer
// is supplied, we ignore both optimizations.
function findUpdatedEventualIndex(containerEl, evtPoint) {
    var _a, _b, _c, _d, _e, _f;
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    let ignoreCurrentNewIndex = containerEl !== ((_a = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl);
    // TODO: There is some glitch in how mouseY works after autoscroll.
    // I don't know what the issue is, but there is some shift introduced,
    // perhaps at this place.
    let mouseY = evtPoint.clientY - containerEl.getClientRects()[0].top;
    let insIndexBefore = (_c = (_b = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _b === void 0 ? void 0 : _b.eventualIndex) !== null && _c !== void 0 ? _c : 0;
    let updatedNewIndex = insIndexBefore;
    const { yStartNoMoveZone, yEndNoMoveZone } = (_d = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) !== null && _d !== void 0 ? _d : {
        yStartNoMoveZone: Infinity,
        yEndNoMoveZone: -Infinity,
    };
    const { containerEl: fromEl, index: fromIndex, } = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from;
    const isMove = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move;
    // TODO: Extract, deduplicate, cache.
    const activeElHeight = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetHeight;
    // Note: placeholderEl may be in a different container, so it's height may
    // be completely broken here. It shouldn't matter, though, as we won't be
    // using it in that case.
    const activeToPlaceholderOffset = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to ? _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.placeholderEl.offsetHeight - activeElHeight : 0;
    const activeToNothingOffset = -activeElHeight - 8;
    const nothingToPlaceholderOffset = (_f = (_e = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _e === void 0 ? void 0 : _e.placeholderEl.offsetHeight) !== null && _f !== void 0 ? _f : 0;
    let wiggleZoneSize = 0.5;
    let snapMargin = (1 - wiggleZoneSize) / 2;
    let bottomSnapBorder = yDirection === -1 ? (1 - snapMargin) : snapMargin;
    let startIndex = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerStartIndex)(containerEl);
    let endIndex = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerEndIndex)(containerEl);
    if (ignoreCurrentNewIndex || (mouseY < yStartNoMoveZone && updatedNewIndex !== 0)) {
        // Correct for the fact that if we dragged the element down from
        // its place, some elements above it are shifted from their
        // offset position.
        let offsetCorrection = containerEl === _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl && isMove ? activeToNothingOffset : 0;
        updatedNewIndex = startIndex;
        // We may look up one extra element at the start, but that is not an issue.
        let iterationStart = endIndex - 1;
        if (!ignoreCurrentNewIndex && insIndexBefore < iterationStart) {
            iterationStart = insIndexBefore;
        }
        for (let i = iterationStart; i >= startIndex; --i) {
            let otherEl = containerEl.children[i];
            if (otherEl === _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl && isMove)
                continue;
            if (i < fromIndex) {
                // We could check for (toEl === fromEl) here, but the
                // value is going to be 0 anyway.
                offsetCorrection = 0;
            }
            if (getComputedStyle(otherEl).display === 'none') {
                continue;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY > otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl after otherEl.
                if (containerEl === fromEl && isMove && i > fromIndex) {
                    // Special new case. otherEl will be moved up
                    // and end up with index i-1, so inserting after
                    // it means we will end up with index i.
                    updatedNewIndex = i;
                }
                else {
                    updatedNewIndex = i + 1;
                }
                break;
            }
        }
    }
    else if (mouseY > yEndNoMoveZone) {
        let offsetCorrection = nothingToPlaceholderOffset;
        // Set to the highest possible value - in case we are at the very
        // bottom of the container.
        updatedNewIndex = (containerEl === fromEl && isMove) ? endIndex - 1 : endIndex;
        // We may look up one extra element at the start, but that is not an issue.
        for (let i = insIndexBefore; i < endIndex; ++i) {
            let otherEl = containerEl.children[i];
            if (otherEl === _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl && isMove)
                continue; // May still happen.
            if (i > fromIndex && containerEl === fromEl && isMove) {
                offsetCorrection = activeToPlaceholderOffset;
            }
            if (getComputedStyle(otherEl).display === 'none') {
                continue;
            }
            let otherTop = otherEl.offsetTop + offsetCorrection;
            let otherHeight = otherEl.offsetHeight;
            if (mouseY < otherTop + bottomSnapBorder * otherHeight) {
                // Insert activeEl before otherEl.
                if (containerEl === fromEl && isMove && i > fromIndex) {
                    // Special new case. otherEl won't be bumped to i+1
                    // but instead back to i-th position when we
                    // re-insert activeEl, so the inserting splice
                    // will be at position i-1, not i.
                    updatedNewIndex = i - 1;
                }
                else {
                    updatedNewIndex = i;
                }
                break;
            }
        }
    }
    return updatedNewIndex;
}
function updatePlaceholderAndNoMoveZone(to) {
    let newPlaceholderTop = findPlaceholderTop(to);
    // TODO: Extract, deduplicate, cache, correct margins.
    const nothingToPlaceholderOffset = to.placeholderEl.offsetHeight;
    to.yStartNoMoveZone = newPlaceholderTop - 8;
    to.yEndNoMoveZone = newPlaceholderTop - nothingToPlaceholderOffset;
    to.placeholderEl.style.transform = `translateY(${newPlaceholderTop}px)`;
}
function findPlaceholderTop({ containerEl: toEl, eventualIndex, }) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    const { containerEl: fromEl, index: oldIndex, } = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from;
    const isMove = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move;
    // TODO: Extract, deduplicate, cache.
    const activeElHeight = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetHeight;
    const activeToNothingOffset = -activeElHeight - 8;
    let startIndex = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerStartIndex)(toEl);
    let endIndex = (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerEndIndex)(toEl);
    let ref, offsetCorrection;
    if (endIndex === startIndex) {
        // We don't have any reference, it will just be at the top.
        // However, the offsetCorrection should probably account for
        // margin/padding.
        ref = null;
        offsetCorrection = 0;
    }
    else if (toEl === fromEl && isMove && eventualIndex === endIndex - 1) {
        // Last element in fromEl.
        ref = toEl.children[endIndex - 1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8 + activeToNothingOffset;
    }
    else if ((toEl !== fromEl || !isMove) && eventualIndex === endIndex) {
        // Last element, not in fromEl.
        ref = toEl.children[endIndex - 1];
        // Position the placeholder _after_ the ref.
        offsetCorrection = ref.offsetHeight + 8;
    }
    else if (toEl === fromEl && isMove && eventualIndex > oldIndex) {
        ref = toEl.children[eventualIndex + 1];
        offsetCorrection = activeToNothingOffset;
    }
    else {
        ref = toEl.children[eventualIndex];
        offsetCorrection = 0;
    }
    // Correct the ref if we hit an element with display: none.
    // Thanks to endIndex check we know that the ref is either displayed
    // itself or there is a displayed object below it, that we will eventually
    // find..
    while (ref && getComputedStyle(ref).display === 'none') {
        ref = ref.nextElementSibling;
    }
    // This will be the new activeEl's top as well, once we move it.
    return ref ? ref.offsetTop + offsetCorrection : offsetCorrection;
}
function stateDrag_window_TouchCancel(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_TouchEnd(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    dragEndedWithRelease();
    event.preventDefault();
    event.stopPropagation();
}
function stateDrag_window_PointerCancel(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    exitDrag(false);
}
function stateDrag_window_PointerUp(event) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    if (event.pointerId !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pointerId) {
        // Not relevant.
        return;
    }
    dragEndedWithRelease();
}
function dragEndedWithRelease() {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    // We can't really prevent the browser for generating a click, but we
    // can capture it. The click will, however, not necessaily generate
    // (only when there was an element that browser thinks was clicked), so
    // we limit blocking to immediately generated events.
    (0,_click_blocker__WEBPACK_IMPORTED_MODULE_2__.preventImmediateClick)();
    // End drag successfully, except when we aren't actually in any container.
    // TODO: Should we have a special handling for touchcancel? OTOH, I don't
    // see it showing up in practice. Maybe except when touch becomes a scroll,
    // but we eliminate that instance.
    exitDrag(Boolean(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to));
}
function exitDrag(execSort) {
    var _a;
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PreDrag &&
        (_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag) {
        throw new Error(`exitDrag called in wrong state: ${_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state}`);
    }
    if (execSort && !(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.state === _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag && _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to)) {
        console.error('Exit drag called with execSort==true, but conditions are not met.');
        execSort = false;
    }
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.state == _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag) {
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatEl.remove(); // Removing this element now saves some special casing.
        if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) {
            _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.placeholderEl.remove();
        }
    }
    else {
        clearTimeout(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.preDragTimeoutId);
    }
    let insertEl = null;
    let dragEndEvent;
    // Note: toEl is implied by execSort, but Typescript doesn't know that.
    if (execSort &&
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state === _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag &&
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to &&
        (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl ||
            _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.eventualIndex !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index)) {
        insertEl = (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move) ? _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.cloneNode(true);
        dragEndEvent = {
            dragExecuted: true,
            item: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl,
            from: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl,
            fromIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index,
            oldIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index,
            to: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl,
            eventualIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.eventualIndex,
            insertionIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.insertionIndex,
            newIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.eventualIndex,
        };
        // Note:
        // We need to adjust the position of elements with transform
        // to avoid shifting them around suddenly. It would be nice
        // to do that in one go for each element, but that would involve
        // several cases and so on. I'll just do that as I go, and not
        // worry that I do that twice for some elements most of the time.
        if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.dragKind === _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind.Move) {
            _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.remove();
        }
        const { containerEl: fromEl, index: fromIndex, } = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from;
        const { containerEl: toEl, eventualIndex, } = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to;
        // TODO: Extract, deduplicate, cache.
        const activeElHeight = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetHeight;
        const activeToNothingOffset = -activeElHeight - 8;
        // Adjust elements after removed and animate them to 0.
        for (let elem of Array.from(fromEl.children).slice(fromIndex)) {
            let currentTransform = (_anims__WEBPACK_IMPORTED_MODULE_1__.transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] -= activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                _anims__WEBPACK_IMPORTED_MODULE_1__.transformsByElem.set(elem, currentTransform);
            }
            _anims__WEBPACK_IMPORTED_MODULE_1__.Anim.start(fromEl, [elem], 0, _anims__WEBPACK_IMPORTED_MODULE_1__.animMs, currentTransform[1]);
        }
        // Remove placeholder.
        _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.placeholderEl.remove();
        // We removed pickedEl before, so now we insert simply at eventualIndex.
        if (eventualIndex === toEl.children.length) {
            toEl.appendChild(insertEl);
        }
        else {
            toEl.children[eventualIndex].before(insertEl);
        }
        // Adjust elements after inserted and animate them to 0.
        for (let elem of Array.from(toEl.children).slice(eventualIndex + 1)) {
            let currentTransform = (_anims__WEBPACK_IMPORTED_MODULE_1__.transformsByElem.get(elem) || [0, 0]);
            currentTransform[1] += activeToNothingOffset;
            if (currentTransform[0] !== 0 || currentTransform[1] !== 0) {
                _anims__WEBPACK_IMPORTED_MODULE_1__.transformsByElem.set(elem, currentTransform);
            }
            _anims__WEBPACK_IMPORTED_MODULE_1__.Anim.start(fromEl, [elem], 0, _anims__WEBPACK_IMPORTED_MODULE_1__.animMs, currentTransform[1]);
        }
    }
    else {
        dragEndEvent = {
            dragExecuted: false,
            item: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl,
            from: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl,
            fromIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index,
            oldIndex: _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.index,
        };
        // When cancelling, let's simply tell everyone to go home.
        for (let cont of [_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, (_a = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl]) {
            if (cont) { // toEl may be missing.
                _anims__WEBPACK_IMPORTED_MODULE_1__.Anim.start(cont, Array.from(cont.children), 0, _anims__WEBPACK_IMPORTED_MODULE_1__.animMs);
            }
        }
    }
    (0,_invisible_item__WEBPACK_IMPORTED_MODULE_10__.cancelInvisible)(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.state == _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag) {
        let animElem = insertEl !== null && insertEl !== void 0 ? insertEl : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl;
        // Our Anim handles only y animation for now, we should fix that.
        // However, let's at least handle the y.
        let destRect = animElem.getClientRects()[0];
        _anims__WEBPACK_IMPORTED_MODULE_1__.Anim.start(animElem, [animElem], 0, _anims__WEBPACK_IMPORTED_MODULE_1__.animMs, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.floatElPos.y - destRect.top);
        if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) {
            removeBottomPaddingCorrection(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl);
            // Invoke onContainerLeft here to be consistent with how it's called
            // in leaveContainer - after the container cleanup.
            const toContainerOptions = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options;
            if (typeof toContainerOptions.onContainerLeft === 'function') {
                toContainerOptions.onContainerLeft(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
            }
        }
    }
    toggleEvents_statePreDrag(false, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.touchDrag);
    toggleEvents_stateDrag(false, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.touchDrag);
    (0,_overscroll_behavior__WEBPACK_IMPORTED_MODULE_12__.revertOverscrollBehavior)();
    (0,_selection_control__WEBPACK_IMPORTED_MODULE_14__.revertUserSelectOnBody)();
    (0,_state__WEBPACK_IMPORTED_MODULE_15__.setDragState)(null);
    // Finally, let call all the drag-end events.
    // All the callbacks get the same event object.
    const fromContainerOptions = dragEndEvent.from[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options;
    if (dragEndEvent.dragExecuted) {
        if (dragEndEvent.to === dragEndEvent.from) {
            if (typeof fromContainerOptions.onInternalChange === 'function') {
                fromContainerOptions.onInternalChange(dragEndEvent);
            }
        }
        else {
            if (typeof fromContainerOptions.onDropToOtherContainer === 'function') {
                fromContainerOptions.onDropToOtherContainer(dragEndEvent);
            }
            const toContainerOptions = dragEndEvent.to[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options;
            if (typeof toContainerOptions.onDropFromOtherContainer === 'function') {
                toContainerOptions.onDropFromOtherContainer(dragEndEvent);
            }
        }
    }
    if (typeof fromContainerOptions.onDragFinished === 'function') {
        fromContainerOptions.onDragFinished(dragEndEvent);
    }
}
function anyState_container_PointerEnter(event) {
    var _a;
    const containerEl = event.currentTarget;
    const containerData = containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando];
    (0,_hover_tracker__WEBPACK_IMPORTED_MODULE_8__.containerHoverEntered)(containerData);
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag) {
        // Not dragging anything, so nothing to do.
        return;
    }
    if (containerEl === ((_a = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
        // Already in this container, nothing to do.
        return;
    }
    maybeEnterContainer(containerData, event);
}
function anyState_container_PointerLeave(event) {
    var _a;
    const containerEl = event.currentTarget;
    const containerData = containerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando];
    (0,_hover_tracker__WEBPACK_IMPORTED_MODULE_8__.containerHoverLeft)(containerData);
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag ||
        containerEl !== ((_a = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
        return; // Not relevant.
    }
    // PointerLeave event might have been caused by releasing the touch or
    // button, however, we can't really tell. event.buttons === 0 works in
    // most browsers, but not iOS Safari (at least not in 14).
    // We will instead wait for other related events to dispatch. In case
    // this is the pointerup case, the drag will be over by the time the timer
    // executes.
    setTimeout(() => {
        var _a;
        // Make sure that the drag is still pending and we didn't move
        // to another container. In issue #8 we were hitting toEl === null here,
        // apparently because several timeouts from several left containers
        // got clamped together.
        if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) === _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag &&
            containerEl === ((_a = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) === null || _a === void 0 ? void 0 : _a.containerEl)) {
            leaveContainer();
            // mousemove handler will figure the container to enter.
            // TODO: if it gets glitchy, call the mousemove handler here directly.
        }
    }, 0);
}
function maybeEnterContainer(containerData, evPlace) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    let cData = containerData;
    let rect = cData.el.getClientRects()[0];
    if (!cData.options.allowDrop || !rect) {
        return false;
    }
    const xLast = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.currentPointerPos.x;
    if (xLast >= rect.left + rect.width * cData.options.enterGuardLeft + cData.options.enterGuardLeftPx &&
        xLast <= rect.right - rect.width * cData.options.enterGuardRight - cData.options.enterGuardRightPx) {
        const eventualIndex = findUpdatedEventualIndex(cData.el, evPlace);
        const insertionIndex = (0,_index_conversions__WEBPACK_IMPORTED_MODULE_9__.insertionIndexFromEventualIndex)(cData.el, eventualIndex);
        if (!_state__WEBPACK_IMPORTED_MODULE_15__.dragState.forbiddenIndices.isForbiddenIndex(cData.el, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl, insertionIndex)) {
            enterContainer(cData.el, insertionIndex, eventualIndex);
            return true;
        }
    }
    return false;
}
function enterContainer(toEl, insertionIndex, eventualIndex) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) {
        // Handle removal from the previous container.
        leaveContainer();
    }
    // Then handle insertion into the new container.
    (0,_scrollers__WEBPACK_IMPORTED_MODULE_13__.updateScrollers)(toEl);
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to = {
        containerEl: toEl,
        insertionIndex,
        eventualIndex,
        placeholderEl: createPlaceholder(toEl),
        yStartNoMoveZone: 0,
        yEndNoMoveZone: 0,
    };
    addBottomPaddingCorrection();
    updatePlaceholderAndNoMoveZone(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to);
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.placeholderEl.style.visibility = 'visible';
    (0,_animate_move__WEBPACK_IMPORTED_MODULE_0__.animateMoveInsideContainer)(toEl, (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerEndIndex)(toEl), eventualIndex);
    const containerOptions = toEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options;
    if (typeof containerOptions.onContainerEntered === 'function') {
        containerOptions.onContainerEntered(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
}
function leaveContainer() {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    if (!_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to) {
        return;
    }
    const leftContainerEl = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl;
    (0,_animate_move__WEBPACK_IMPORTED_MODULE_0__.animateMoveInsideContainer)(leftContainerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.eventualIndex, (0,_dom_traversal__WEBPACK_IMPORTED_MODULE_3__.getItemsInContainerEndIndex)(leftContainerEl));
    removeBottomPaddingCorrection(leftContainerEl);
    _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to = undefined;
    const containerOptions = leftContainerEl[_expando__WEBPACK_IMPORTED_MODULE_5__.expando].options;
    if (typeof containerOptions.onContainerLeft === 'function') {
        containerOptions.onContainerLeft(leftContainerEl, _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl);
    }
}
function createPlaceholder(toEl) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    const placeholderEl = document.createElement('div');
    placeholderEl.style.position = 'absolute';
    placeholderEl.style.top = '0';
    placeholderEl.style.zIndex = '1';
    placeholderEl.style.background = 'lightgray';
    placeholderEl.style.userSelect = 'none';
    placeholderEl.style.pointerEvents = 'none';
    placeholderEl.style.visibility = 'hidden';
    placeholderEl.classList.add('drag-placeholder');
    // Note: that may be before or after floatEl. Maybe that is the problem?
    toEl.appendChild(placeholderEl);
    // Set the height only if not set externally.
    let autoHeight = getComputedStyle(placeholderEl).height;
    if (!autoHeight || autoHeight === '0px') {
        placeholderEl.style.height = Math.min(_state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetHeight - 16, 200) + 'px';
    }
    // TODO: Figure out how to determine these properly. I guess we need to take
    // the container's clientWidth and make the actual math with margins and
    // stuff.
    // For now let's assume that the offsets on activeEl are ok and that
    // they are the same on both sides.
    placeholderEl.style.left = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetLeft + 'px';
    placeholderEl.style.right = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.pickedEl.offsetLeft + 'px';
    return placeholderEl;
}
function addBottomPaddingCorrection() {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    if (_state__WEBPACK_IMPORTED_MODULE_15__.dragState.to && _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl) {
        const toEl = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.containerEl;
        const nothingToPlaceholderOffset = _state__WEBPACK_IMPORTED_MODULE_15__.dragState.to.placeholderEl.offsetHeight;
        toEl.style.paddingBottom =
            parseFloat(getComputedStyle(toEl).paddingBottom.slice(0, -2)) + nothingToPlaceholderOffset + 'px';
    }
}
function removeBottomPaddingCorrection(toEl) {
    if ((_state__WEBPACK_IMPORTED_MODULE_15__.dragState === null || _state__WEBPACK_IMPORTED_MODULE_15__.dragState === void 0 ? void 0 : _state__WEBPACK_IMPORTED_MODULE_15__.dragState.state) !== _state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag)
        throw new _state__WEBPACK_IMPORTED_MODULE_15__.BadStateError(_state__WEBPACK_IMPORTED_MODULE_15__.StateEnum.PendingDrag);
    if (toEl !== _state__WEBPACK_IMPORTED_MODULE_15__.dragState.from.containerEl) {
        toEl.style.paddingBottom = '';
    }
}
function createFloatEl(dragState) {
    const pickedEl = dragState.pickedEl;
    const floatEl = pickedEl.cloneNode(true);
    floatEl.style.position = 'fixed';
    floatEl.style.left = '0';
    floatEl.style.top = '0';
    floatEl.style.margin = '0';
    floatEl.style.zIndex = '10000000';
    floatEl.style.pointerEvents = 'none';
    floatEl.style.width = getComputedStyle(pickedEl).width;
    floatEl.style.height = getComputedStyle(pickedEl).height;
    const tOrigX = -dragState.floatFromPointerOffset.x;
    const tOrigY = -dragState.floatFromPointerOffset.y;
    floatEl.style.transformOrigin = `${tOrigX}px ${tOrigY}px`;
    const posX = dragState.currentPointerPos.x + dragState.floatFromPointerOffset.x;
    const posY = dragState.currentPointerPos.y + dragState.floatFromPointerOffset.y;
    floatEl.style.transform = `translate(${posX}px,${posY}px) scale(${dragState.floatElScale})`;
    floatEl.classList.add('drag-float-item');
    // Position fixed is great, but it has limitation: if any ancestor
    // has transform, perspective, or filter property set other than none,
    // it becomes the containing block instead of the viewport, and your
    // perfect plan for positioning gets royally screwed. That is why we
    // need to put the floatEl directly on document.body.
    //
    // We may some day add an option to put it on the container, a counterpart
    // to Sortable's fallbackOnBody, but for now we just need it outside
    // and free of any rogue containing block candidates.
    document.body.appendChild(floatEl);
    return floatEl;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    init: initDragContainer,
    DragKind: _external_types__WEBPACK_IMPORTED_MODULE_6__.DragKind,
});

})();

/******/ })()
;
//# sourceMappingURL=omicron-dnd.js.map