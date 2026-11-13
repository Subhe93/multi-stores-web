// Full page reload, in its own module so tests can replace it (jsdom's
// `window.location` cannot be redefined).
export function reloadPage(): void {
  window.location.reload();
}
