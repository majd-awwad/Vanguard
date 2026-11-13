const namespace = "http://www.w3.org/2000/svg";
const height = 312;
const left = 92;
const right = 665;
const top = 42;
const bottom = 258;

function svg(name, attributes, content) {
  const element = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (content !== undefined) element.textContent = content;
  return element;
}

function label(x, y, text, anchor = "start") {
  return svg("text", { x, y, "text-anchor": anchor, class: "axis-text" }, text);
}

export function mountVisual(root, session, translate) {
  const { data } = session;
  const floor = data.edges[0];
  const ceiling = data.edges.at(-1);
  const y = (meters) => bottom - ((meters - floor) / (ceiling - floor)) * (bottom - top);
  const distance = data.footprints.at(-1).distance;
  const x = (meters) => left + 19 + (meters / distance) * (right - left - 38);
  let container, selectionBox, cursor, previousAxis, previousShot;

  function scaffold(axis) {
    container = svg("svg", { viewBox: `0 0 714 ${height}`, focusable: "false" });
    container.append(label(left, 25, translate("plotHeight")));
    for (const tick of [-10, 0, 10, 20]) {
      container.append(svg("line", {
        x1: left, x2: right, y1: y(tick), y2: y(tick), class: tick === 0 ? "base-line" : "grid-line",
      }), label(left - 10, y(tick) + 4, `${tick} m`, "end"));
    }
    container.append(label((left + right) / 2, height - 13,
      translate(axis === "horizontal" ? "plotDistance" : "plotShare"), "middle"));
  }

  function horizontal() {
    selectionBox = svg("rect", { x: left, width: right - left, rx: 2, class: "band" });
    container.append(selectionBox);
    const width = 41;
    for (const row of data.footprints) {
      const center = x(row.distance);
      container.append(svg("rect", { x: center - width / 2, y: top, width, height: bottom - top, rx: 3, class: "column" }));
      row.profile.forEach((value, index) => {
        if (value <= 0) return;
        container.append(svg("rect", {
          x: center - width / 2 + 2, y: y(data.edges[index + 1]), width: width - 4,
          height: y(data.edges[index]) - y(data.edges[index + 1]) - 0.3,
          opacity: 0.15 + 0.85 * Math.sqrt(value),
          class: "return-cell",
        }));
      });
      container.append(label(center, bottom + 17, String(row.index + 1).padStart(2, "0"), "middle"));
      container.append(label(center, bottom + 31, `${Math.round(row.distance)} m`, "middle"));
      const hit = svg("rect", { x: center - width / 2 - 6, y: top, width: width + 12, height: bottom - top + 27, class: "hit" });
      hit.addEventListener("click", () => session.dispatch({ type: "footprint", shotId: row.id }));
      container.append(hit);
    }
    cursor = svg("rect", { y: top - 2, width: width + 5, height: bottom - top + 4, rx: 4, class: "active", "pointer-events": "none" });
    container.append(cursor);
  }

  function vertical(observation) {
    const span = right - left;
    const scale = Math.max(0.4, Math.ceil(Math.max(...data.footprints.flatMap((row) => row.profile)) * 10) / 10);
    for (let index = 0; index <= 4; index++) {
      const tickX = left + span * index / 4;
      container.append(svg("line", { x1: tickX, x2: tickX, y1: top, y2: bottom, class: "grid-line" }),
        label(tickX, bottom + 19, `${Math.round(scale * 100 * index / 4)}%`, "middle"));
    }
    const binHeight = (bottom - top) / (data.edges.length - 1);
    observation.profile.forEach((fraction, index) => {
      const bandY = y(data.edges[index + 1]);
      if (fraction > 0) {
        container.append(svg("rect", {
          x: left, y: bandY + 0.8, width: span * fraction / scale,
          height: binHeight - 1.5, rx: 1, class: "return-cell",
        }));
      }
      const hit = svg("rect", { x: left, y: bandY, width: span, height: binHeight, class: "hit" });
      hit.addEventListener("click", () => session.dispatch({ type: "height", index }));
      container.append(hit);
    });
    cursor = svg("rect", { x: left, width: span, height: binHeight, rx: 2, class: "pulse", "pointer-events": "none" });
    container.append(cursor);
  }

  function render({ selection, event, observation, transport }) {
    const { axis } = selection;
    if (axis !== previousAxis || (axis === "vertical" && previousShot !== observation.id)) {
      scaffold(axis);
      if (axis === "horizontal") horizontal();
      else vertical(observation);
      root.replaceChildren(container);
      previousAxis = axis;
      previousShot = observation.id;
    }
    if (axis === "horizontal") {
      const [lower, upper] = selection.bandM;
      selectionBox.setAttribute("y", y(upper));
      selectionBox.setAttribute("height", y(lower) - y(upper));
      cursor.setAttribute("x", x(observation.distance) - 23);
    } else {
      cursor.setAttribute("y", y(event.evidence.band[1]));
    }
    cursor.setAttribute("opacity", transport.awaitingOnset ? "0.45" : "1");
    root.dataset.event = event.id;
  }

  const dispose = session.subscribe(render);
  return {
    refresh() {
      previousAxis = undefined;
      render(session.snapshot());
    },
    dispose,
  };
}
