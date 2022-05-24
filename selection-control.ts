declare global {
    interface CSSStyleDeclaration {
        // Typescript doesn't know about some -webkit extensions.
        webkitUserSelect: string,
        webkitTouchCallout: string,
    }
}

let killed = false;
let bodyUserSelect: string | null;
let bodyWebkitUserSelect: string | null;
let bodyWebkitTouchCallout: string | null;

export function killSelection() {
  if (killed) return;
  bodyUserSelect = document.body.style.userSelect;
  bodyWebkitUserSelect = document.body.style.webkitUserSelect;
  bodyWebkitTouchCallout = document.body.style.webkitTouchCallout;
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.webkitTouchCallout = 'none';
  killed = true;
}


export function revertSelection() {
  if (killed) return;
  document.body.style.userSelect = bodyUserSelect;
  document.body.style.webkitUserSelect = bodyWebkitUserSelect;
  document.body.style.webkitTouchCallout = bodyWebkitTouchCallout;
  killed = false;
}
