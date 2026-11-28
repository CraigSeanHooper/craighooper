/* The clock icon, top right, shows the visitor's own time. The hands are the icon's
   two strokes: the longer one is the minute hand, the shorter the hour hand. */
(() => {
  const clock = document.getElementById("clock");
  if (!clock) return;
  const hour = clock.querySelector(".clock-hour");
  const minute = clock.querySelector(".clock-minute");
  const label = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  function tick() {
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const h = (now.getHours() % 12) + m / 60;
    minute.setAttribute("transform", `rotate(${m * 6} 16 16)`);
    hour.setAttribute("transform", `rotate(${h * 30} 16 16)`);
    clock.setAttribute("aria-label", `Your time: ${label.format(now)}`);
    // next update at the start of the next minute
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
  }
  tick();
})();
