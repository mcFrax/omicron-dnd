let saved: {
  htmlOvescrollBehavior: string,
  bodyOvescrollBehavior: string,
} | null;

export function disableOverscrollBehavior() {
  if (saved) return;
  // Prevent the scroll-to-refresh behavior and the effect
  // of bumping into the scroll end on mobile.
  saved = {
    htmlOvescrollBehavior: document.documentElement.style.overscrollBehavior,
    bodyOvescrollBehavior: document.body.style.overscrollBehavior,
  };
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overscrollBehavior = 'none';
}

export function revertOverscrollBehavior() {
  if (!saved) return;
  document.documentElement.style.overscrollBehavior = saved.htmlOvescrollBehavior;
  document.body.style.overscrollBehavior = saved.bodyOvescrollBehavior;
  saved = null;
}
