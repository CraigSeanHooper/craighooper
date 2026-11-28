/* The hidden page under the dot. The dot links to #easter-egg and the CSS (:target) does the
   opening and closing; this adds the parts CSS can't: focus, the back button, Escape, and
   the browser bar colour. */
(() => {
  const egg = document.getElementById("easter-egg");
  const dot = document.getElementById("dot");
  const back = document.getElementById("dot-back");
  if (!egg || !dot || !back) return;

  const behind = [...document.body.children].filter(el => el !== egg && el.tagName !== "SCRIPT");
  const themes = [...document.querySelectorAll('meta[name="theme-color"]')];
  const pageThemes = themes.map(m => m.content);
  const home = document.title;
  const isOpen = () => location.hash === "#easter-egg";
  let openedHere = false;

  function sync(moveFocus) {
    const open = isOpen();
    egg.inert = !open;
    behind.forEach(el => { el.inert = open; });
    themes.forEach((m, i) => { m.content = open ? "#1a1a1a" : pageThemes[i]; });
    document.title = open ? "A hidden page. Craig Hooper." : home;
    if (moveFocus) (open ? back : dot).focus({ preventScroll: true });
    if (!open) openedHere = false;
  }

  function close() {
    if (openedHere) history.back();   // so the browser's own Back doesn't reopen it
    else location.hash = "";
  }

  dot.addEventListener("click", () => { openedHere = true; });
  back.addEventListener("click", e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    close();
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) close(); });
  addEventListener("hashchange", () => sync(true));
  sync(false);

  // ready to show before anyone clicks, so the photo is there as the dot opens
  const img = egg.querySelector("img");
  if (img.decode) img.decode().catch(() => {});
})();
