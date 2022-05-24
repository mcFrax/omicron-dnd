let killed = false;
let htmlOvescrollBehavior: string | null;
let bodyOvescrollBehavior: string | null;

export function killOverscrollBehavior() {
  if (killed) return;
  // Prevent the scroll-to-refresh behavior and the effect
  // of bumping into the scroll end on mobile.
  htmlOvescrollBehavior = document.documentElement.style.overscrollBehavior;
  bodyOvescrollBehavior = document.body.style.overscrollBehavior;
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overscrollBehavior = 'none';
  killed = true;
}

export function revertOverscrollBehavior() {
  if (!killed) return;
  document.documentElement.style.overscrollBehavior = htmlOvescrollBehavior;
  document.body.style.overscrollBehavior = bodyOvescrollBehavior;
  killed = false;
}
