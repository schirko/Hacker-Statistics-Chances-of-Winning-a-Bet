// Reads the page's CSS colour variables so canvas charts follow the light/dark theme.
(function () {
  const get = () => {
    const s = getComputedStyle(document.documentElement), v = (n) => s.getPropertyValue(n).trim();
    return { ink: v("--ink"), muted: v("--muted"), line: v("--line"), surface: v("--surface"), bg: v("--bg"),
      accent: v("--accent"), win: v("--win"), lose: v("--lose"), gold: v("--gold") };
  };
  const fns = [];
  window.Theme = { get, onChange: (f) => fns.push(f) };
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const h = () => fns.forEach((f) => f());
  if (mq.addEventListener) mq.addEventListener("change", h); else mq.addListener(h);
})();
