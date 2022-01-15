# Omicron drag&drop

Omicron is a fast JavaScript drag-and-drop library for desktop and mobile browsers.

Demo: http://eytlohe.cluster029.hosting.ovh.net/omicron/drag-and-drop-test.html


## Features

* excellent performance, can handle thousands of items across multiple containers
* remains reasonably responsive under heavy load
* supports touch devices
* supports nested containers
* CSS animation for moving items
* smooth autoscroll
* no framework required


## Usage

```html
<html>
  <body>
    <ul id="list">
      <li>item 1</li>
      <li>item 2</li>
      <li>item 3</li>
    </ul>
  </body>
  <script type="module">
    import OmicronDnd from './omicron-dnd.js';
    var container = document.getElementById('list');
    OmicronDnd.init(container);
  </script>
</html>
```


## Configuration & API

*(see source code comments for more details)*

```javascript
OmicronDnd.init(container, {
    // CSS selector for draggable children of the container.
    draggableSelector: null,
    // CSS selector for elements that can't be used to drag an item.
    filterSelector: null,
    // CSS selector for handle element.
    handleSelector: null,
    // Scale factor for making the dragged element smaller.
    floatElScale: 1,

    // Called just after the conditions for the drag start are met.
    onBeforeDragStart: null,
    // The element is actually being dragged now. The return value is ignored.
    onDragStart: null,
    // This will fire right after onDragStart and for every entered container.
    onContainerEntered: null,
    // This will fire at the end of the drag, too, before the drag finish events.
    onContainerLeft: null,
    // Called on change when container didn't change.
    onInternalChange: null,
    // Called on fromEl when toEl !== fromEl.
    onDropToOtherContainer: null,
    // Called on toEl when toEl !== fromEl.
    onDropFromOtherContainer: null,
    // The drag or pre-drag was finished.
    onDragFinished: null,
});
```


## Why "Omicron"?

This project was started when Franek, its main author, was sitting at home with
Covid-19 (most probably Omicron variant, hence the name).
