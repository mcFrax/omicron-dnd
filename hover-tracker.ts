
import { getDomDepth } from "./dom-traversal";
import { ContainerData } from "./expando";

// List of containerData for all the initialized container elements
// currently under the pointer, at all times (i.e. not only when the drag
// is active).
// Updated with pointerenter/pointerleave events.
// Sorted from the deepest to most shallow in the DOM tree.
export const hoverContainersByDepth: ContainerData[] = [];

export function getHoverContainersDeeperThan(domDepth: number) {
  return hoverContainersByDepth.filter((container) => container.domDepth > domDepth);
}

export function containerHoverEntered(containerData: ContainerData) {
    containerData.domDepth = getDomDepth(containerData.el);
    if (hoverContainersByDepth.indexOf(containerData) === -1) {
        hoverContainersByDepth.push(containerData);
        hoverContainersByDepth.sort(cmpDomDepth);
    }
}

export function containerHoverLeft(containerData: ContainerData) {
    let delIdx;
    if ((delIdx = hoverContainersByDepth.indexOf(containerData)) !== -1) {
        hoverContainersByDepth.splice(delIdx, 1);
    }
}

// Compare function for hoverContainersByDepth.
function cmpDomDepth(a: ContainerData, b: ContainerData) {
    return b.domDepth - a.domDepth;
}
