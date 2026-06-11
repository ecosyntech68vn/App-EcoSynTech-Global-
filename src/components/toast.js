// Toast notification — frugal, no library
// V3.0.1 — longer default + 6s for errors so CEO/farmer can actually read them
export function showToast(msg, type = '', timeout) {
  if (timeout === undefined) {
    timeout = (type === 'err' || type === 'error') ? 6000 : 4000;
  }
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  // Tap-to-dismiss for long errors
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}
