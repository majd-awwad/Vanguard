// The Earth Master certificate: drawn locally in a canvas (no server, no external image), downloadable as a PNG.
// It says "Team Vanguard" and "Not an official NASA certificate". Drawing code takes any 2D-context-like object, so it can be tested.

export const CERT_SIZE = Object.freeze({ width: 1600, height: 1131 });

const FONT = '"Instrument Sans", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif';
const SERIF = '"Instrument Serif", "IBM Plex Sans Arabic", Georgia, "Times New Roman", serif';

function trophy(ctx, cx, cy, s) {
  ctx.save();
  ctx.fillStyle = "#ffcb86";
  ctx.strokeStyle = "#ffcb86";
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy - s * 0.6); ctx.lineTo(cx + s * 0.38, cy + s * 0.1);
  ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.38, cy + s * 0.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - s * 0.52, cy - s * 0.3, s * 0.2, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + s * 0.52, cy - s * 0.3, s * 0.2, Math.PI * 1.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillRect(cx - s * 0.06, cy + s * 0.35, s * 0.12, s * 0.28);
  ctx.fillRect(cx - s * 0.3, cy + s * 0.6, s * 0.6, s * 0.12);
  ctx.fillStyle = "#06121c";
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.2, s * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#68e0d0"; ctx.lineWidth = s * 0.03;
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.2, s * 0.2, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.2); ctx.lineTo(cx + s * 0.2, cy - s * 0.2); ctx.moveTo(cx, cy - s * 0.4); ctx.bezierCurveTo(cx - s * 0.12, cy - s * 0.3, cx - s * 0.12, cy - s * 0.1, cx, cy); ctx.moveTo(cx, cy - s * 0.4); ctx.bezierCurveTo(cx + s * 0.12, cy - s * 0.3, cx + s * 0.12, cy - s * 0.1, cx, cy); ctx.stroke();
  ctx.restore();
}

/**
 * Draws the certificate. `details`: { name, score, language, dateText, levels: [{ n, name, score }], text: { certificate, team, congrats, line, disclaimer, scoreLine, date } }
 * (all strings come from the game copy so the certificate follows the language).
 */
export function drawCertificate(ctx, details) {
  const { width: W, height: H } = CERT_SIZE;
  const rtl = details.language === "ar";
  ctx.save();
  ctx.direction = rtl ? "rtl" : "ltr";
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#06121c"); bg.addColorStop(1, "#0d2a3a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#68e0d0"; ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = "rgba(255,203,134,.6)"; ctx.lineWidth = 2; ctx.strokeRect(62, 62, W - 124, H - 124);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#68e0d0"; ctx.font = `600 34px ${FONT}`;
  ctx.fillText(details.text.certificate + " — " + details.text.team, W / 2, 150);
  trophy(ctx, W / 2, 290, 150);
  ctx.fillStyle = "#f0f4fa"; ctx.font = `400 70px ${SERIF}`;
  ctx.fillText(details.text.congrats, W / 2, 470);
  ctx.fillStyle = "#ffcb86"; ctx.font = `400 108px ${SERIF}`;
  let size = 108;
  while (ctx.measureText && ctx.measureText(details.name).width > W - 280 && size > 40) { size -= 6; ctx.font = `400 ${size}px ${SERIF}`; }
  ctx.fillText(details.name, W / 2, 600);
  ctx.fillStyle = "#f0f4fa"; ctx.font = `400 38px ${FONT}`;
  ctx.fillText(details.text.line, W / 2, 680);
  ctx.fillStyle = "#68e0d0"; ctx.font = `600 54px ${FONT}`;
  ctx.fillText(details.text.scoreLine, W / 2, 770);
  // level summary: five bars
  const barW = 230, gap = 30, total = details.levels.length * barW + (details.levels.length - 1) * gap;
  let x = (W - total) / 2;
  ctx.font = `500 24px ${FONT}`;
  for (const level of details.levels) {
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(x, 830, barW, 18);
    ctx.fillStyle = "#68e0d0"; ctx.fillRect(x, 830, (barW * level.score) / 100, 18);
    ctx.fillStyle = "#c9d6e4"; ctx.fillText(`${level.n} · ${level.score}/100`, x + barW / 2, 880);
    x += barW + gap;
  }
  ctx.fillStyle = "#9fb0c3"; ctx.font = `400 28px ${FONT}`;
  ctx.fillText(details.text.date, W / 2, 960);
  ctx.fillStyle = "#ffcb86"; ctx.font = `600 28px ${FONT}`;
  ctx.fillText(details.text.disclaimer, W / 2, 1040);
  ctx.fillStyle = "#9fb0c3"; ctx.font = `400 22px ${FONT}`;
  ctx.fillText("EARTHPULSE · NASA GMAO GEOS-FP model data", W / 2, 1080);
  ctx.restore();
}

/** Saves the canvas as a PNG through a temporary link (works offline). Returns true when a download was started. */
export function downloadCanvas(canvas, filename, { document = globalThis.document, url = globalThis.URL } = {}) {
  const save = (href, revoke) => {
    const link = document.createElement("a");
    link.href = href; link.download = filename + ".png"; link.rel = "noopener";
    document.body.append(link); link.click(); link.remove();
    if (revoke) setTimeout(() => url.revokeObjectURL(href), 4000);
    return true;
  };
  if (canvas.toBlob) { canvas.toBlob((blob) => { if (blob) save(url.createObjectURL(blob), true); else save(canvas.toDataURL("image/png"), false); }, "image/png"); return true; }
  return save(canvas.toDataURL("image/png"), false);
}
