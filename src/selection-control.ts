declare global {
    interface CSSStyleDeclaration {
        // Typescript doesn't know about some -webkit extensions.
        webkitTouchCallout: string,
    }
}

let saved: {
  bodyUserSelect: string,
  // These may actually be undefined, but it doesn't really matter - they are
  // assignable where they should be anyway.
  bodyWebkitUserSelect: string,
  bodyWebkitTouchCallout: string,
} | null;

export function disableUserSelectOnBody() {
  if (saved) return;
  saved = {
    bodyUserSelect: document.body.style.userSelect,
    bodyWebkitUserSelect: document.body.style.webkitUserSelect,
    bodyWebkitTouchCallout: document.body.style.webkitTouchCallout,
  }
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.webkitTouchCallout = 'none';
}

export function revertUserSelectOnBody() {
  if (!saved) return;
  document.body.style.userSelect = saved.bodyUserSelect;
  document.body.style.webkitUserSelect = saved.bodyWebkitUserSelect;
  document.body.style.webkitTouchCallout = saved.bodyWebkitTouchCallout;
  saved = null;
}
