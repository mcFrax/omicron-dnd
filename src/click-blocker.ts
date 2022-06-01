
function preventSingleHandler(event: MouseEvent) {
    // We can't really prevent the browser for generating a click, but we
    // can capture it and stop all effects.
    event.stopPropagation();
    event.preventDefault();
    document.removeEventListener('click', preventSingleHandler, true);
}

export function preventNextClick() {
    document.addEventListener('click', preventSingleHandler, true);
}

export function preventImmediateClick() {
    document.addEventListener('click', preventSingleHandler, true);
    // We want to only prevent click event that is already generated,
    // so we will remove the handler right after the current queue is
    // processed.
    setTimeout(removeClickBlocker, 0);
}

export function removeClickBlocker() {
    document.removeEventListener('click', preventSingleHandler, true);
}
