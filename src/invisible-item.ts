
export function makeInvisible(elem: HTMLElement) {
    // Theoretically some descendants can have visibility set explicitly
    // to visible and then whey would be visible anyway, so let's double
    // down with opacity: 0;
    elem.style.visibility = 'hidden';
    elem.style.opacity = '0';
    elem.style.pointerEvents = 'none';
    elem.classList.add('drag-active-item');
}

export function cancelInvisible(elem: HTMLElement) {
    // Note: if there were any inline styles on the element, uh, we have
    // just erased them. I think that is resonable to force users to just
    // deal with it.
    elem.classList.remove('drag-active-item');
    elem.style.visibility = '';
    elem.style.opacity = '';
    elem.style.pointerEvents = '';
}
