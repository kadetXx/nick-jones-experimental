(function () {
  "use strict";

  // --- constants --------------------------------------------------------

  var PHI = 1.6180339887498949;
  var FIX = 0.723606797749979; // fixed point of the similarity, as a fraction of the frame
  var ANC = 4; // ancestor levels, purely to keep the viewport covered while rotating
  var LEVELS = 22;
  var ART_LEVELS = 14; // below this the square is a few pixels; a flat fill reads the same

  var PAD_RATIO = 0.006; // gutter, as a fraction of the shorter viewport side

  // Easing is expressed per 60Hz frame and rescaled by the real frame time
  // in tick(), so a 120Hz or 240Hz display settles at the same wall-clock speed.
  var EASE_FREE = 0.095; // while you're driving it
  var EASE_SNAP = 0.055; // gentler pull once it's committed to a section
  var SNAP_DELAY = 150; // ms of stillness before it commits
  var FLICK_MIN = 0.15; // travel below this counts as a twitch, not a move

  var WHEEL_SPEED = 0.0018;
  var DRAG_SPEED = 0.0035;
  var LINE_DELTA_PX = 16; // deltaMode 1: lines
  var PAGE_DELTA_PX = 400; // deltaMode 2: pages
  var MAX_FRAME_MS = 100; // clamp, so a backgrounded tab doesn't resume with one enormous step
  var FRAME_MS_60HZ = 16.6667;

  var THEMES = [
    { panel: "#3b2159", bg: "#bd79d6", ink: "#c07be0", accent: "#f2bcff" },
    { panel: "#1e1f2e", bg: "#d5c9b4", ink: "#d5c9b4", accent: "#8f8aa8" },
    { panel: "#0f3b38", bg: "#e8d9c0", ink: "#e8d9c0", accent: "#5fa896" },
    { panel: "#4a1d2c", bg: "#e5a6a1", ink: "#e5a6a1", accent: "#c4687c" },
    { panel: "#16223f", bg: "#8fb8e8", ink: "#8fb8e8", accent: "#5b82bd" },
    { panel: "#2d2a12", bg: "#d6d04c", ink: "#d6d04c", accent: "#9a9430" },
    { panel: "#33190f", bg: "#e79b5a", ink: "#e79b5a", accent: "#b06a33" },
    { panel: "#123027", bg: "#7fd9b0", ink: "#7fd9b0", accent: "#479b76" },
  ];

  // --- helpers ----------------------------------------------------------

  function mod(a, m) {
    return ((a % m) + m) % m;
  }

  // Two decimals is the most an SVG at this scale can show.
  function n(value) {
    return (+value).toFixed(2);
  }

  function attrs(map) {
    var out = "";

    for (var key in map) {
      out += " " + key + '="' + map[key] + '"';
    }

    return out;
  }

  function tag(name, map) {
    return "<" + name + attrs(map) + "/>";
  }

  function svg(body) {
    var open =
      "<svg" +
      attrs({
        class: "art",
        viewBox: "0 0 100 100",
        preserveAspectRatio: "xMidYMid slice",
      }) +
      ">";

    return open + body + "</svg>";
  }

  // --- plates -----------------------------------------------------------
  // Eight compositions, all built from the same subdivision the page is.

  function plateSpiral() {
    var GROWTH = 0.22;
    var TURNS = 8 * Math.PI;
    var STEP = 0.05;
    var MAX_R = 82;

    var points = [];

    for (var t = 0; t <= TURNS; t += STEP) {
      var r = GROWTH * Math.pow(PHI, (2 * t) / Math.PI);
      if (r > MAX_R) break;

      var x = 50 + r * Math.cos(t);
      var y = 50 + r * Math.sin(t);
      points.push(n(x) + "," + n(y));
    }

    return svg(
      tag("polyline", {
        class: "line",
        "stroke-width": 1.1,
        points: points.join(" "),
      })
    );
  }

  function plateBands() {
    var widths = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    var total = widths.reduce(function (sum, value) {
      return sum + value;
    }, 0);

    var parts = [];
    var x = 0;

    for (var i = 0; i < widths.length; i++) {
      var w = (widths[i] / total) * 100;

      if (i % 2 === 0) {
        parts.push(
          tag("rect", {
            class: "ink",
            x: n(x),
            y: 0,
            width: n(w),
            height: 100,
            opacity: n(0.22 + i * 0.075),
          })
        );
      }

      x += w;
    }

    return svg(parts.join(""));
  }

  function plateFan() {
    var RAYS = 26;
    var REACH = 170;

    var parts = [];

    for (var k = 0; k <= RAYS; k++) {
      var a = ((k / RAYS) * Math.PI) / 2;

      parts.push(
        tag("line", {
          class: "line",
          "stroke-width": 0.75,
          x1: 0,
          y1: 100,
          x2: n(REACH * Math.cos(a)),
          y2: n(100 - REACH * Math.sin(a)),
          opacity: n(0.25 + 0.55 * Math.sin(a)),
        })
      );
    }

    return svg(parts.join(""));
  }

  function plateEclipse() {
    var behind = tag("circle", {
      class: "ink",
      cx: 40,
      cy: 43,
      r: 31,
      opacity: 0.9,
    });

    var front = tag("circle", {
      class: "acc",
      cx: 63,
      cy: 63,
      r: 31,
      opacity: 0.8,
    });

    return svg(behind + front);
  }

  // Squares converging on the corner: the page's own construction.
  function plateSquares() {
    var STEPS = 10;

    var parts = [];
    var x = 0;
    var y = 0;
    var size = 100;

    for (var k = 0; k < STEPS; k++) {
      parts.push(
        tag("rect", {
          class: "line",
          "stroke-width": 0.8,
          x: n(x),
          y: n(y),
          width: n(size),
          height: n(size),
          opacity: n(1 - k * 0.075),
        })
      );

      var next = size / PHI;
      x += size - next;
      y += size - next;
      size = next;
    }

    return svg(parts.join(""));
  }

  function plateWaves() {
    var ROWS = 10;
    var ROW_GAP = 11;
    var AMPLITUDE = 4.5;
    var SAMPLE = 4;

    var parts = [];

    for (var row = 0; row < ROWS; row++) {
      var y0 = row * ROW_GAP - 3;
      var d = "M -5 " + n(y0);

      for (var x = 0; x <= 105; x += SAMPLE) {
        var phase = ((x / 100) * Math.PI * 2) + row * 0.55;
        d += " L " + n(x) + " " + n(y0 + AMPLITUDE * Math.sin(phase));
      }

      parts.push(
        tag("path", {
          class: "line",
          "stroke-width": 0.85,
          d: d,
          opacity: n(0.22 + row * 0.072),
        })
      );
    }

    return svg(parts.join(""));
  }

  // Dot matrix, weighted toward one corner.
  function plateDots() {
    var GRID = 9;
    var GAP = 11.5;

    var parts = [];

    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        parts.push(
          tag("circle", {
            class: "ink",
            cx: n(c * GAP + 6),
            cy: n(r * GAP + 6),
            r: n(0.7 + 4.3 * ((r + c) / 16)),
            opacity: 0.85,
          })
        );
      }
    }

    return svg(parts.join(""));
  }

  // Concentric rings pinned to the upper-right corner.
  function plateRings() {
    var RINGS = 11;
    var DECAY = 0.82;

    var parts = [];

    for (var k = 0; k < RINGS; k++) {
      parts.push(
        tag("circle", {
          class: "line",
          "stroke-width": 0.9,
          cx: 100,
          cy: 0,
          r: n(118 * Math.pow(DECAY, k)),
          opacity: n(1 - k * 0.07),
        })
      );
    }

    return svg(parts.join(""));
  }

  // Plates are drawn once, up front: no requests, and sharp from full-screen
  // down to the last sub-pixel square.
  var ART = [
    plateSpiral(),
    plateBands(),
    plateFan(),
    plateEclipse(),
    plateSquares(),
    plateWaves(),
    plateDots(),
    plateRings(),
  ];

  // --- colour -----------------------------------------------------------

  function rgb(hex) {
    var body = hex.slice(1);

    return [
      parseInt(body.slice(0, 2), 16),
      parseInt(body.slice(2, 4), 16),
      parseInt(body.slice(4, 6), 16),
    ];
  }

  function mix(from, to, t) {
    var a = rgb(from);
    var b = rgb(to);

    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);

    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  // --- stage ------------------------------------------------------------

  var stage = document.getElementById("stage");
  var clip = document.getElementById("clip");
  var spiral = document.getElementById("spiral");

  var panels = [];
  var rootEl = null;

  function build() {
    var root = document.createElement("div");
    root.className = "frame";

    var cur = root;

    for (var i = 0; i < LEVELS; i++) {
      var panel = document.createElement("div");
      panel.className = "panel";
      cur.appendChild(panel);
      panels.push(panel);

      if (i < LEVELS - 1) {
        var next = document.createElement("div");
        next.className = "frame child";
        cur.appendChild(next);
        cur = next;
      }
    }

    spiral.appendChild(root);
    rootEl = root;
  }

  function layout() {
    var shortSide = Math.min(window.innerWidth, window.innerHeight);
    var pad = Math.max(2, Math.round(shortSide * PAD_RATIO));
    clip.style.inset = pad + "px";

    var vw = window.innerWidth - pad * 2;
    var vh = window.innerHeight - pad * 2;

    // Level ANC is the one that fills the clip box; the levels above it are scaffolding.
    var fit = Math.max(vw, vh * PHI);
    var w = fit * Math.pow(PHI, ANC);
    var h = w / PHI;

    rootEl.style.width = w + "px";
    rootEl.style.left = FIX * vw - FIX * w + "px";
    rootEl.style.top = FIX * vh - FIX * h + "px";
  }

  // --- input ------------------------------------------------------------

  var target = 0;
  var pos = 0;

  var settled = true;
  var lastInput = -1e9;
  var origin = 0;

  function nudge(d) {
    if (settled) origin = Math.round(target);

    settled = false;
    target += d;
    lastInput = performance.now();
  }

  function snap() {
    var delta = target - origin;
    var step = 0;

    if (Math.abs(delta) > FLICK_MIN) {
      step = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta)));
    }

    target = origin + step;
    settled = true;
  }

  function onWheel(e) {
    e.preventDefault();

    var d = e.deltaY;
    if (e.deltaMode === 1) d *= LINE_DELTA_PX;
    else if (e.deltaMode === 2) d *= PAGE_DELTA_PX;

    nudge(d * WHEEL_SPEED);
  }

  var dragging = false;
  var lastY = 0;

  function onPointerDown(e) {
    dragging = true;
    lastY = e.clientY;
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;

    nudge((lastY - e.clientY) * DRAG_SPEED);
    lastY = e.clientY;
  }

  function endDrag() {
    dragging = false;
    stage.classList.remove("dragging");
  }

  function onKeyDown(e) {
    var forward = e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ";
    var back = e.key === "ArrowUp" || e.key === "PageUp";

    if (forward) {
      e.preventDefault();
      nudge(1);
    } else if (back) {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    }
  }

  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", layout);

  // --- fullscreen -------------------------------------------------------

  var docEl = document.documentElement;
  var enter = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
  var leave = document.exitFullscreen || document.webkitExitFullscreen;

  function isFull() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    if (!enter) return;

    var p = isFull() ? leave.call(document) : enter.call(docEl);

    // An embed may refuse the request; there is no UI to fall back to.
    if (p && p.catch) p.catch(function () {});
  }

  // Browsers only grant fullscreen from a real gesture, so take the first one.
  var autoFs = true;

  function claimFullscreen() {
    if (!autoFs) return;

    autoFs = false;
    if (enter && !isFull()) toggleFullscreen();
  }

  stage.addEventListener("pointerdown", claimFullscreen);
  window.addEventListener("keydown", claimFullscreen);

  // --- sound ------------------------------------------------------------
  // The track only ever starts from the button. Pressing it is the gesture
  // browsers require for audible playback, so nothing else has to arrange one.

  var track = document.getElementById("track");
  var soundBtn = document.getElementById("sound");

  var ICON_ON =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path class="cone" d="M4 9h3l5-4v14l-5-4H4z"/>' +
    '<path d="M16 9.5a3.5 3.5 0 0 1 0 5"/>' +
    '<path d="M18.5 7a7 7 0 0 1 0 10"/>' +
    "</svg>";

  var ICON_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path class="cone" d="M4 9h3l5-4v14l-5-4H4z"/>' +
    '<path d="M16 9.5l5 5"/>' +
    '<path d="M21 9.5l-5 5"/>' +
    "</svg>";

  var playing = false;

  function drawSoundBtn() {
    soundBtn.innerHTML = playing ? ICON_ON : ICON_OFF;
    soundBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    soundBtn.setAttribute("aria-label", playing ? "Turn sound off" : "Turn sound on");
  }

  function setPlaying(on) {
    playing = on;
    drawSoundBtn();
  }

  soundBtn.addEventListener("pointerdown", function (e) {
    // Otherwise the press also drags the spiral and claims fullscreen.
    e.stopPropagation();
  });

  soundBtn.addEventListener("click", function (e) {
    e.stopPropagation();

    if (playing) {
      track.pause();
      setPlaying(false);
      return;
    }

    setPlaying(true);

    var p = track.play();
    // If the browser refuses anyway, put the button back rather than lie.
    if (p && p.catch) {
      p.catch(function () {
        setPlaying(false);
      });
    }
  });

  drawSoundBtn();

  // --- loop -------------------------------------------------------------

  var lastIndex = null;
  var lastFrame = performance.now();

  function paintPlates(index) {
    for (var k = 0; k < ART_LEVELS; k++) {
      panels[k].innerHTML = ART[mod(index + k - ANC, ART.length)];
    }
  }

  function paintTheme(index, t) {
    var e = t * t * (3 - 2 * t); // smoothstep, so the palette settles rather than ramps
    var a = THEMES[mod(index, THEMES.length)];
    var b = THEMES[mod(index + 1, THEMES.length)];
    var s = stage.style;

    s.setProperty("--panel", mix(a.panel, b.panel, e));
    s.setProperty("--bg", mix(a.bg, b.bg, e));
    s.setProperty("--ink", mix(a.ink, b.ink, e));
    s.setProperty("--accent", mix(a.accent, b.accent, e));
    s.setProperty("--line", mix(a.bg, b.bg, e));
  }

  function tick(now) {
    var dt = Math.min(now - lastFrame, MAX_FRAME_MS);
    lastFrame = now;

    if (!dragging && !settled && now - lastInput > SNAP_DELAY) snap();

    var ease = settled ? EASE_SNAP : EASE_FREE;
    pos += (target - pos) * (1 - Math.pow(1 - ease, dt / FRAME_MS_60HZ));
    if (settled && Math.abs(target - pos) < 0.0002) pos = target;

    var i = Math.floor(pos);
    var t = pos - i;

    // One step = a quarter turn back plus a phi scale-up: the exact inverse of
    // the subdivision, so level n+1 lands precisely where level n was.
    var turn = "rotate(" + -90 * t + "deg)";
    var zoom = "scale(" + Math.pow(PHI, t) + ")";
    spiral.style.transform = turn + " " + zoom;

    if (i !== lastIndex) {
      lastIndex = i;
      paintPlates(i);
    }

    paintTheme(i, t);

    requestAnimationFrame(tick);
  }

  build();
  layout();
  requestAnimationFrame(tick);
})();
