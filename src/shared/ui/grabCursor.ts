/** On the body while something is dragged with the pointer: grabbing hand, no text selection. */
const GRABBING_CLASS = "grabbing";

export const setGrabbing = (on: boolean) => document.body.classList.toggle(GRABBING_CLASS, on);
