const App = {
  active: "longitudinal",
  timers: new Map(),
  initialized: new Set()
};

function $(id) {
  return document.getElementById(id);
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits).replace(".", ",");
}

function updateStatus(text) {
  $("status-text").textContent = text;
}

function startTimer(name, fn, interval) {
  stopTimer(name);
  App.timers.set(name, window.setInterval(fn, interval));
}

function stopTimer(name) {
  if (App.timers.has(name)) {
    window.clearInterval(App.timers.get(name));
    App.timers.delete(name);
  }
}

function stopAllTimers() {
  for (const name of App.timers.keys()) stopTimer(name);
  longitudinal.running = false;
  transversal.running = false;
  lissajous.running = false;
  pendulo.running = false;
  orbitas.running = false;
  viscoso.running = false;
  snell.running = false;
}

function setActiveSimulation(simId) {
  document.querySelectorAll(".sim-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `sim-${simId}`);
  });
  document.querySelectorAll(".nav-button[data-sim]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sim === simId);
  });
  App.active = simId;
  $("active-sim-pill").textContent = simId;
  updateStatus(`Panel activo: ${simId}`);
  renderActiveSimulation();
}

function renderActiveSimulation() {
  switch (App.active) {
    case "longitudinal":
      drawLongitudinal();
      break;
    case "transversal":
      drawTransversal();
      break;
    case "lissajous":
      drawLissajous();
      break;
    case "pendulo":
      drawPendulo();
      break;
    case "orbitas":
      drawOrbitas();
      break;
    case "viscoso":
      drawViscoso();
      break;
    case "snell":
      calculateSnell();
      break;
  }
}

function createAxis(ctx, width, height) {
  ctx.strokeStyle = "#d0d0d0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const longitudinal = {
  running: false,
  time: 0,
  mode: 1,
  particles: [],
  displacement: [],
  pressure: []
};

function syncLongitudinalDerived() {
  const np = Math.max(2, Math.round(parseNumber($("longi-np").value, 30)) - 1);
  const length = parseNumber($("longi-l").value, 0.5);
  const k0 = parseNumber($("longi-kcor").value, 141610) / 1000000;
  const ro = parseNumber($("longi-ro").value, 1.225);
  const cv = Math.sqrt(k0 / ro);
  const c = Math.sqrt(cv * cv * 1000000);
  const lambda = (2 * length) / longitudinal.mode;
  const k = (2 * Math.PI) / lambda;
  const w = k * cv;
  const f = (c * longitudinal.mode) / (2 * length);
  $("longi-c").value = formatNumber(c, 2);
  $("longi-f").value = formatNumber(f, 2);
  $("longi-lambda").value = formatNumber(lambda, 2);
  $("longi-k").value = formatNumber(k, 2);
  longitudinal.np = np;
  longitudinal.length = length;
  longitudinal.cv = cv;
  longitudinal.k = k;
  longitudinal.w = w;
  longitudinal.amplitude = parseNumber($("longi-a").value, 0.05);
  longitudinal.dt = parseNumber($("longi-dt").value, 0.05);
  longitudinal.scaleD = parseNumber($("longi-scale-d").value, 30);
  longitudinal.scaleP = parseNumber($("longi-scale-p").value, 30);
  longitudinal.interval = Math.max(5, parseNumber($("longi-interval").value, 50));
}

function resetLongitudinalTime(equilibrium = false) {
  longitudinal.time = equilibrium ? Math.PI / (2 * longitudinal.w || 1) : 0;
  drawLongitudinal();
}

function stepLongitudinal() {
  longitudinal.time += longitudinal.dt;
  drawLongitudinal();
}

function drawLongitudinal() {
  syncLongitudinalDerived();
  const tube = $("longi-canvas-main");
  const graph = $("longi-canvas-graph");
  const ctxTube = tube.getContext("2d");
  const ctxGraph = graph.getContext("2d");
  ctxTube.clearRect(0, 0, tube.width, tube.height);
  ctxGraph.clearRect(0, 0, graph.width, graph.height);

  const margin = 60;
  const effectiveWidth = tube.width - margin * 2;
  const midY = tube.height / 2;
  const alt = 70;
  const graphWidth = graph.width - margin * 2;
  const scaleD = longitudinal.scaleD / 12;
  const scaleP = longitudinal.scaleP / 70;
  longitudinal.particles = [];
  longitudinal.displacement = [];
  longitudinal.pressure = [];

  ctxTube.strokeStyle = "#3a3a3a";
  ctxTube.strokeRect(margin, midY - alt / 2, effectiveWidth, alt);
  ctxTube.beginPath();
  for (let i = 0; i <= longitudinal.np; i += 1) {
    const x = margin + (i / longitudinal.np) * effectiveWidth;
    ctxTube.moveTo(x, midY + alt / 2);
    ctxTube.lineTo(x, midY + alt / 2 + 10);
  }
  ctxTube.stroke();

  ctxGraph.strokeStyle = "#d0d0d0";
  ctxGraph.beginPath();
  ctxGraph.moveTo(0, graph.height / 2);
  ctxGraph.lineTo(graph.width, graph.height / 2);
  ctxGraph.stroke();

  let prevDisp = null;
  let prevPress = null;
  for (let i = 0; i <= longitudinal.np; i += 1) {
    const xp = (i * longitudinal.length) / longitudinal.np;
    const displacement = longitudinal.amplitude * Math.sin(longitudinal.k * xp) * Math.cos(longitudinal.w * longitudinal.time);
    const dfdx = longitudinal.amplitude * longitudinal.k * Math.cos(longitudinal.k * xp) * Math.cos(longitudinal.w * longitudinal.time);
    longitudinal.displacement.push(displacement);
    longitudinal.pressure.push(dfdx);

    const tubeX = margin + ((displacement + xp / longitudinal.length) * effectiveWidth);
    longitudinal.particles.push(tubeX);
    ctxTube.strokeStyle = "#0050d0";
    ctxTube.beginPath();
    ctxTube.moveTo(tubeX, midY - alt / 2);
    ctxTube.lineTo(tubeX, midY + alt / 2);
    ctxTube.stroke();

    const graphX = margin + (xp / longitudinal.length) * graphWidth;
    const dispY = (0.5 - displacement * scaleD) * graph.height;
    const pressY = (0.5 + dfdx * scaleP) * graph.height;

    if (prevDisp) {
      ctxGraph.strokeStyle = "#0050d0";
      ctxGraph.beginPath();
      ctxGraph.moveTo(prevDisp.x, prevDisp.y);
      ctxGraph.lineTo(graphX, dispY);
      ctxGraph.stroke();
      ctxGraph.strokeStyle = "#c00000";
      ctxGraph.beginPath();
      ctxGraph.moveTo(prevPress.x, prevPress.y);
      ctxGraph.lineTo(graphX, pressY);
      ctxGraph.stroke();
    }
    prevDisp = { x: graphX, y: dispY };
    prevPress = { x: graphX, y: pressY };
  }

  updateStatus(`Longitudinal t=${formatNumber(longitudinal.time, 2)} s`);
}

function initLongitudinal() {
  if (App.initialized.has("longitudinal")) return;
  App.initialized.add("longitudinal");

  $("longi-modo").addEventListener("input", (event) => {
    longitudinal.mode = parseInt(event.target.value, 10);
    $("longi-modo-value").textContent = String(longitudinal.mode);
    drawLongitudinal();
  });
  $("longi-interval").addEventListener("input", (event) => {
    $("longi-interval-value").textContent = event.target.value;
    syncLongitudinalDerived();
  });
  $("longi-scale-d").addEventListener("input", (event) => {
    $("longi-scale-d-value").textContent = event.target.value;
    drawLongitudinal();
  });
  $("longi-scale-p").addEventListener("input", (event) => {
    $("longi-scale-p-value").textContent = event.target.value;
    drawLongitudinal();
  });
  $("longi-aplicar").addEventListener("click", () => drawLongitudinal());
  $("longi-equilibrio").addEventListener("click", () => resetLongitudinalTime(true));
  $("longi-paso").addEventListener("click", () => {
    longitudinal.running = false;
    stopTimer("longitudinal");
    stepLongitudinal();
  });
  $("longi-detener").addEventListener("click", () => {
    longitudinal.running = false;
    stopTimer("longitudinal");
    updateStatus("Longitudinal detenida");
  });
  $("longi-reiniciar").addEventListener("click", () => {
    longitudinal.running = false;
    stopTimer("longitudinal");
    resetLongitudinalTime(false);
  });
  $("longi-continuar").addEventListener("click", () => {
    syncLongitudinalDerived();
    longitudinal.running = true;
    startTimer("longitudinal", stepLongitudinal, longitudinal.interval);
    updateStatus("Longitudinal en ejecucion");
  });

  drawLongitudinal();
}

const transversal = {
  running: false,
  time: 0,
  dt: 0.1,
  amps: new Array(13).fill(0)
};

function buildTransversalSliders() {
  const host = $("transv-harmonics");
  host.innerHTML = "";
  const defaults = [500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 13; i += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "harmonic";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1000";
    slider.step = "1";
    slider.value = String(defaults[i]);
    slider.id = `transv-amp-${i}`;
    const label = document.createElement("div");
    label.className = "harmonic-label";
    label.id = `transv-amp-label-${i}`;
    slider.addEventListener("input", () => {
      transversal.amps[i] = (100 / 300) * (parseInt(slider.value, 10) / 1000);
      label.textContent = `${i + 1}: ${formatNumber(transversal.amps[i], 2)}`;
      drawTransversal();
    });
    wrapper.appendChild(slider);
    wrapper.appendChild(label);
    host.appendChild(wrapper);
    slider.dispatchEvent(new Event("input"));
  }
}

function waveTransversal(xp) {
  const pi = Math.PI;
  const k = 2 * pi / 200;
  const c = Math.sqrt(100 / 0.1);
  const w = k * c;
  let value = 0;
  for (let i = 0; i < transversal.amps.length; i += 1) {
    const n = i + 1;
    value += transversal.amps[i] * Math.sin(k * n * xp) * Math.cos(w * n * transversal.time);
  }
  return -value;
}

function drawTransversal() {
  const canvas = $("transv-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  createAxis(ctx, canvas.width, canvas.height);

  const margin = 10;
  const width = canvas.width - margin * 2;
  const height = canvas.height;
  let prev = null;
  for (let i = 0; i <= 800; i += 1) {
    const xp = i * (100 / 800);
    const screenX = margin / 2 + (xp / 100) * width;
    const screenY = (0.5 - waveTransversal(xp)) * height;
    if (prev) {
      ctx.strokeStyle = "#0048c8";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    }
    prev = { x: screenX, y: screenY };
  }
  updateStatus(`Transversal t=${formatNumber(transversal.time, 2)} s`);
}

function initTransversal() {
  if (App.initialized.has("transversal")) return;
  App.initialized.add("transversal");
  buildTransversalSliders();
  $("transv-paso").addEventListener("click", () => {
    transversal.time += transversal.dt;
    drawTransversal();
  });
  $("transv-retroceder").addEventListener("click", () => {
    transversal.time -= transversal.dt;
    drawTransversal();
  });
  $("transv-equilibrio").addEventListener("click", () => {
    const c = Math.sqrt(100 / 0.1);
    transversal.time = (2 * 100 * c) - transversal.dt;
    drawTransversal();
  });
  $("transv-detener").addEventListener("click", () => {
    transversal.running = false;
    stopTimer("transversal");
    updateStatus("Transversal detenida");
  });
  $("transv-continuar").addEventListener("click", () => {
    transversal.running = true;
    startTimer("transversal", () => {
      transversal.time += transversal.dt;
      drawTransversal();
    }, 10);
    updateStatus("Transversal en ejecucion");
  });
  drawTransversal();
}

const lissajous = {
  running: false,
  t: 0,
  points: []
};

function getLissajousParams() {
  const a = parseNumber($("lissa-a").value, 120);
  const b = parseNumber($("lissa-b").value, 120);
  const w1 = parseNumber($("lissa-w1").value, 4);
  const w2 = parseNumber($("lissa-w2").value, 8);
  const rawPhase = parseNumber($("lissa-phase").value, 0.5);
  const phase = ($("lissa-phase-pi").checked ? Math.PI : 1) * rawPhase;
  return { a, b, w1, w2, phase };
}

function lissajousPoint(t) {
  const { a, b, w1, w2, phase } = getLissajousParams();
  return {
    x: a * Math.cos(w1 * t),
    y: b * Math.cos(w2 * t + phase)
  };
}

function drawLissajous() {
  const canvas = $("lissa-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  createAxis(ctx, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  if (lissajous.points.length > 1) {
    ctx.strokeStyle = "#c00000";
    ctx.beginPath();
    ctx.moveTo(centerX + lissajous.points[0].x, centerY - lissajous.points[0].y);
    for (let i = 1; i < lissajous.points.length; i += 1) {
      ctx.lineTo(centerX + lissajous.points[i].x, centerY - lissajous.points[i].y);
    }
    ctx.stroke();
  }
  if (lissajous.points.length > 0) {
    const last = lissajous.points[lissajous.points.length - 1];
    ctx.fillStyle = "#0048c8";
    ctx.beginPath();
    ctx.arc(centerX + last.x, centerY - last.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lissajousStep() {
  lissajous.t += 0.1;
  lissajous.points.push(lissajousPoint(lissajous.t));
  drawLissajous();
}

function drawFullLissajous() {
  lissajous.points = [];
  const { w1, w2 } = getLissajousParams();
  const limit = 10 * (w1 <= w2 ? (2.1 * Math.PI) / w1 : (2.1 * Math.PI) / w2);
  for (let t = 0; t <= limit; t += 0.1) {
    lissajous.points.push(lissajousPoint(t));
  }
  lissajous.t = limit;
  drawLissajous();
}

function initLissajous() {
  if (App.initialized.has("lissajous")) return;
  App.initialized.add("lissajous");
  ["lissa-a", "lissa-b", "lissa-w1", "lissa-w2", "lissa-phase", "lissa-phase-pi"].forEach((id) => {
    $(id).addEventListener("change", drawLissajous);
  });
  $("lissa-dibujar").addEventListener("click", () => {
    lissajous.running = false;
    stopTimer("lissajous");
    drawFullLissajous();
    updateStatus("Lissajous dibujada");
  });
  $("lissa-paso").addEventListener("click", () => {
    lissajous.running = false;
    stopTimer("lissajous");
    lissajousStep();
  });
  $("lissa-limpiar").addEventListener("click", () => {
    lissajous.running = false;
    stopTimer("lissajous");
    lissajous.t = 0;
    lissajous.points = [];
    drawLissajous();
  });
  $("lissa-animar").addEventListener("click", () => {
    lissajous.running = !lissajous.running;
    if (lissajous.running) {
      startTimer("lissajous", lissajousStep, 20);
      updateStatus("Lissajous animando");
    } else {
      stopTimer("lissajous");
      updateStatus("Lissajous detenida");
    }
  });
  drawLissajous();
}

const pendulo = {
  running: false,
  time: 0,
  rows: [],
  radial: 140,
  theta: 0.5,
  dRdt: 0,
  dTheta: 0.02,
  d2Rdt2: 0,
  d2Theta2: 0
};

function readPenduloInputs() {
  pendulo.k = parseNumber($("pend-k").value, 0.2);
  pendulo.longL0 = parseNumber($("pend-l0").value, 120);
  pendulo.mass = parseNumber($("pend-masa").value, 10);
  pendulo.gravity = parseNumber($("pend-g").value, 9.81);
  pendulo.dRdt = parseNumber($("pend-drdt").value, pendulo.dRdt);
  pendulo.radial = parseNumber($("pend-radio").value, 140);
  pendulo.dTheta = parseNumber($("pend-dthetadt").value, pendulo.dTheta);
  pendulo.theta = parseNumber($("pend-theta").value, pendulo.theta);
  pendulo.dt = parseNumber($("pend-dt").value, 0.02);
  pendulo.tMax = parseNumber($("pend-tmax").value, 40);
  pendulo.gamma = parseNumber($("pend-gamma").value, 0);
  pendulo.inextensible = $("pend-inextensible").checked;
  pendulo.trace = $("pend-traza").checked;
}

function resetPendulo() {
  readPenduloInputs();
  pendulo.running = false;
  pendulo.time = 0;
  pendulo.rows = [];
  pendulo.d2Rdt2 = 0;
  pendulo.d2Theta2 = 0;
  stopTimer("pendulo");
  drawPendulo();
}

function penduloStep() {
  readPenduloInputs();
  const ftang = -pendulo.mass * pendulo.gravity * Math.sin(pendulo.theta) - pendulo.gamma * pendulo.dTheta * pendulo.radial;
  const fradial = pendulo.mass * pendulo.gravity * Math.cos(pendulo.theta) - pendulo.k * (pendulo.radial - pendulo.longL0) - pendulo.gamma * pendulo.dRdt;
  pendulo.d2Rdt2 = (fradial / pendulo.mass) + pendulo.radial * pendulo.dTheta ** 2;
  pendulo.d2Theta2 = ((ftang / pendulo.mass) - 2 * pendulo.dRdt * pendulo.dTheta) / Math.max(1e-6, pendulo.radial);
  if (!pendulo.inextensible) pendulo.dRdt += pendulo.d2Rdt2 * pendulo.dt;
  pendulo.dTheta += pendulo.d2Theta2 * pendulo.dt;
  pendulo.radial += pendulo.dRdt * pendulo.dt;
  pendulo.theta += pendulo.dTheta * pendulo.dt;
  pendulo.time += pendulo.dt;
  pendulo.rows.push([
    pendulo.time,
    pendulo.radial,
    pendulo.dRdt,
    pendulo.d2Rdt2,
    pendulo.theta,
    pendulo.dTheta,
    pendulo.d2Theta2
  ]);
  if (pendulo.time >= pendulo.tMax) {
    pendulo.running = false;
    stopTimer("pendulo");
  }
  drawPendulo();
}

function drawPendulo() {
  const canvas = $("pend-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const anchorX = canvas.width / 2;
  const anchorY = 42;
  const x = anchorX + pendulo.radial * Math.sin(pendulo.theta);
  const y = anchorY + pendulo.radial * Math.cos(pendulo.theta);

  ctx.fillStyle = "#222";
  ctx.fillRect(anchorX - 40, anchorY - 12, 80, 6);
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const segments = 18;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const sx = anchorX + (x - anchorX) * t + Math.sin(t * Math.PI * 8) * 5 * Math.cos(pendulo.theta);
    const sy = anchorY + (y - anchorY) * t + Math.sin(t * Math.PI * 8) * 5 * -Math.sin(pendulo.theta);
    if (i === 0) ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  if (pendulo.trace && pendulo.rows.length > 1) {
    ctx.strokeStyle = "rgba(192,0,0,0.5)";
    ctx.beginPath();
    for (let i = 0; i < pendulo.rows.length; i += 1) {
      const row = pendulo.rows[i];
      const px = anchorX + row[1] * Math.sin(row[4]);
      const py = anchorY + row[1] * Math.cos(row[4]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "#0050d0";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(6, Math.floor(pendulo.mass * 0.9)), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.fillText(`t=${formatNumber(pendulo.time, 2)}   r=${formatNumber(pendulo.radial, 2)}   theta=${formatNumber(pendulo.theta, 3)}`, 12, canvas.height - 12);
}

function exportPendulo() {
  const titles = ["Tiempo", "Radio", "dr/dt", "d2r/dt2", "Fi", "dFi/dt", "d2Fi/dt2"];
  const rows = [titles.join("\t")];
  pendulo.rows.forEach((row) => {
    rows.push(row.map((value) => String(value)).join("\t"));
  });
  downloadText("pendulo_elastico.tsv", `${rows.join("\n")}\n`);
  updateStatus(`Pendulo exportado: ${pendulo.rows.length} filas`);
}

function initPendulo() {
  if (App.initialized.has("pendulo")) return;
  App.initialized.add("pendulo");
  $("pend-iniciar").addEventListener("click", () => {
    readPenduloInputs();
    pendulo.running = true;
    startTimer("pendulo", penduloStep, Math.max(10, pendulo.dt * 1000));
    updateStatus("Pendulo en ejecucion");
  });
  $("pend-detener").addEventListener("click", () => {
    pendulo.running = false;
    stopTimer("pendulo");
    updateStatus("Pendulo detenido");
  });
  $("pend-reset").addEventListener("click", resetPendulo);
  $("pend-export").addEventListener("click", exportPendulo);
  resetPendulo();
}

const orbitas = {
  running: false,
  time: 0,
  dt: 0.01,
  radialSeries: [],
  angularSeries: []
};

function readOrbitasInputs() {
  orbitas.theta = parseNumber($("orb-theta").value, 0);
  orbitas.dTheta = parseNumber($("orb-dtheta").value, 1.92);
  orbitas.d2Theta = parseNumber($("orb-d2theta").value, 0);
  orbitas.radio = parseNumber($("orb-radio").value, 30);
  orbitas.dRadio = parseNumber($("orb-dradio").value, 1);
  orbitas.d2Radio = parseNumber($("orb-d2radio").value, 0);
  orbitas.k = parseNumber($("orb-k").value, 4);
  orbitas.lNat = parseNumber($("orb-lnat").value, 0);
  orbitas.force = $("orb-force").value;
  orbitas.overlay = $("orb-graph-overlay").checked;
  orbitas.Mg = 1000;
  orbitas.mc = 1;
}

function resetOrbitas() {
  readOrbitasInputs();
  orbitas.time = 0;
  orbitas.running = false;
  orbitas.path = [];
  orbitas.radialSeries = [];
  orbitas.angularSeries = [];
  stopTimer("orbitas");
  drawOrbitas();
}

function orbitasStep() {
  readOrbitasInputs();
  const fuerzaR = orbitas.force === "grav"
    ? -(1 * orbitas.Mg * orbitas.mc) / (orbitas.radio ** 2)
    : -orbitas.k * (orbitas.radio - orbitas.lNat);
  orbitas.d2Radio = (fuerzaR / orbitas.mc) + orbitas.radio * orbitas.dTheta ** 2;
  orbitas.dRadio += orbitas.d2Radio * orbitas.dt;
  orbitas.radio = Math.abs(orbitas.radio + orbitas.dRadio * orbitas.dt);
  const fuerzaT = 0;
  orbitas.d2Theta = (fuerzaT / (orbitas.mc * Math.max(orbitas.radio, 1e-6))) - 2 * orbitas.dRadio * orbitas.dTheta / Math.max(orbitas.radio, 1e-6);
  orbitas.dTheta += orbitas.d2Theta * orbitas.dt;
  orbitas.theta += orbitas.dTheta * orbitas.dt;
  orbitas.time += orbitas.dt;
  orbitas.path.push({ x: orbitas.radio * Math.cos(orbitas.theta), y: -orbitas.radio * Math.sin(orbitas.theta) });
  orbitas.radialSeries.push([orbitas.time, orbitas.radio, orbitas.dRadio, orbitas.d2Radio]);
  orbitas.angularSeries.push([orbitas.time, Math.atan(Math.tan(orbitas.theta)), orbitas.dTheta, orbitas.d2Theta]);
  if (orbitas.path.length > 1500) orbitas.path.shift();
  if (orbitas.radialSeries.length > 400) orbitas.radialSeries.shift();
  if (orbitas.angularSeries.length > 400) orbitas.angularSeries.shift();
  if (orbitas.time >= 100) {
    orbitas.running = false;
    stopTimer("orbitas");
  }
  drawOrbitas();
}

function drawSeries(canvasId, series, scaleDivisor, colors) {
  const canvas = $(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ececec";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 4);
  ctx.lineTo(canvas.width, canvas.height / 4);
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.moveTo(0, (3 * canvas.height) / 4);
  ctx.lineTo(canvas.width, (3 * canvas.height) / 4);
  ctx.stroke();

  if (series.length < 2) return;
  for (let j = 1; j <= 3; j += 1) {
    ctx.strokeStyle = colors[j - 1];
    ctx.beginPath();
    for (let i = 0; i < series.length; i += 1) {
      const x = (i / (series.length - 1)) * canvas.width;
      const base = orbitas.overlay ? canvas.height / 2 : (j * canvas.height) / 4;
      const y = base - series[i][j] / scaleDivisor;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawOrbitas() {
  const canvas = $("orb-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const scale = 4;
  ctx.fillStyle = "#ff8f1f";
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  if (orbitas.path && orbitas.path.length > 1) {
    ctx.strokeStyle = "#c00000";
    ctx.beginPath();
    ctx.moveTo(cx + orbitas.path[0].x * scale, cy + orbitas.path[0].y * scale);
    for (let i = 1; i < orbitas.path.length; i += 1) {
      ctx.lineTo(cx + orbitas.path[i].x * scale, cy + orbitas.path[i].y * scale);
    }
    ctx.stroke();
  }

  const satX = cx + orbitas.radio * Math.cos(orbitas.theta) * scale;
  const satY = cy - orbitas.radio * Math.sin(orbitas.theta) * scale;
  ctx.fillStyle = "#0050d0";
  ctx.beginPath();
  ctx.arc(satX, satY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillText(`t=${formatNumber(orbitas.time, 2)}  r=${formatNumber(orbitas.radio, 2)}  dtheta=${formatNumber(orbitas.dTheta, 2)}`, 12, canvas.height - 12);

  drawSeries("orb-radial-canvas", orbitas.radialSeries, 4, ["#111", "#c00000", "#0050d0"]);
  drawSeries("orb-angular-canvas", orbitas.angularSeries, 4, ["#111", "#c00000", "#0050d0"]);
}

function initOrbitas() {
  if (App.initialized.has("orbitas")) return;
  App.initialized.add("orbitas");
  $("orb-iniciar").addEventListener("click", () => {
    readOrbitasInputs();
    orbitas.running = true;
    startTimer("orbitas", orbitasStep, 10);
    updateStatus("Orbitas en ejecucion");
  });
  $("orb-detener").addEventListener("click", () => {
    orbitas.running = false;
    stopTimer("orbitas");
    updateStatus("Orbitas detenidas");
  });
  $("orb-reset").addEventListener("click", resetOrbitas);
  resetOrbitas();
}

const viscoso = {
  running: false,
  time: 0,
  x: 0,
  dxdt: 0,
  d2xdt2: 0,
  samples: []
};

function readViscosoInputs() {
  viscoso.r = parseNumber($("visc-radio").value, 1.825) / 1000;
  viscoso.ro = parseNumber($("visc-densidad").value, 800) / 1000;
  viscoso.m = parseNumber($("visc-masa").value, 0.162) / 1000;
  viscoso.nu = parseNumber($("visc-nu").value, 0.2);
  viscoso.g = parseNumber($("visc-g").value, 9.8);
  viscoso.dt = parseNumber($("visc-dt").value, 0.01);
}

function resetViscoso() {
  readViscosoInputs();
  viscoso.running = false;
  viscoso.time = 0;
  viscoso.x = 0;
  viscoso.dxdt = 0;
  viscoso.d2xdt2 = 0;
  viscoso.samples = [];
  stopTimer("viscoso");
  drawViscoso();
}

function viscosoStep() {
  readViscosoInputs();
  viscoso.time += viscoso.dt;
  viscoso.d2xdt2 = viscoso.g - (6 * Math.PI * viscoso.r * viscoso.nu * viscoso.dxdt) / viscoso.m - (((viscoso.ro * 4 * Math.PI * viscoso.g * viscoso.r ** 3) / 3) / viscoso.m);
  viscoso.dxdt += viscoso.d2xdt2 * viscoso.dt;
  viscoso.x += viscoso.dxdt * viscoso.dt;
  viscoso.samples.push([viscoso.time, viscoso.x, viscoso.dxdt]);
  if (viscoso.samples.length > 500) viscoso.samples.shift();
  if (viscoso.x * 300 + 50 >= 280 || viscoso.x * 300 + 50 <= 20) {
    viscoso.running = false;
    stopTimer("viscoso");
  }
  drawViscoso();
}

function drawViscoso() {
  const canvas = $("visc-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 3;
  ctx.strokeStyle = "#0048c8";
  ctx.strokeRect(cx - 90, 20, 180, canvas.height - 40);
  ctx.fillStyle = "rgba(0, 80, 208, 0.15)";
  ctx.fillRect(cx - 90, 20, 180, canvas.height - 40);
  const particleY = viscoso.x * 300 + 50;
  ctx.fillStyle = "#c00000";
  ctx.beginPath();
  ctx.arc(cx, particleY, 10, 0, Math.PI * 2);
  ctx.fill();

  const graphX = canvas.width - 280;
  const graphY = 24;
  const graphW = 240;
  const graphH = 120;
  ctx.strokeStyle = "#808080";
  ctx.strokeRect(graphX, graphY, graphW, graphH);
  if (viscoso.samples.length > 1) {
    const maxTime = viscoso.samples[viscoso.samples.length - 1][0] || 1;
    ctx.strokeStyle = "#c00000";
    ctx.beginPath();
    for (let i = 0; i < viscoso.samples.length; i += 1) {
      const px = graphX + (viscoso.samples[i][0] / maxTime) * graphW;
      const py = graphY + graphH / 2 - viscoso.samples[i][1] * 80;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = "#008a00";
    ctx.beginPath();
    for (let i = 0; i < viscoso.samples.length; i += 1) {
      const px = graphX + (viscoso.samples[i][0] / maxTime) * graphW;
      const py = graphY + graphH / 2 - viscoso.samples[i][2] * 50;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#111";
  ctx.fillText(`t=${formatNumber(viscoso.time, 2)}  x=${formatNumber(viscoso.x, 3)}  v=${formatNumber(viscoso.dxdt, 3)}`, 12, canvas.height - 12);
}

function initViscoso() {
  if (App.initialized.has("viscoso")) return;
  App.initialized.add("viscoso");
  $("visc-iniciar").addEventListener("click", () => {
    readViscosoInputs();
    viscoso.running = true;
    startTimer("viscoso", viscosoStep, Math.max(10, viscoso.dt * 1000));
    updateStatus("Fluido viscoso en ejecucion");
  });
  $("visc-detener").addEventListener("click", () => {
    viscoso.running = false;
    stopTimer("viscoso");
    updateStatus("Fluido viscoso detenido");
  });
  $("visc-reset").addEventListener("click", resetViscoso);
  resetViscoso();
}

const materials = [
  ["Aire", 1.0],
  ["Vidrio", 1.5],
  ["Agua", 1.333],
  ["Azucar", 1.56],
  ["Diamante", 2.417],
  ["Mica", 1.58],
  ["Benceno", 1.504],
  ["Glicerina", 1.47],
  ["Alcohol etilico", 1.362],
  ["Aceite de oliva", 1.46]
];

const snell = {
  running: false,
  angle: 30
};

function populateSnellMaterials() {
  const selectA = $("snell-material-1");
  const selectB = $("snell-material-2");
  materials.forEach(([label, value], index) => {
    const optionA = document.createElement("option");
    optionA.value = value;
    optionA.textContent = label;
    if (index === 0) optionA.selected = true;
    const optionB = optionA.cloneNode(true);
    if (index === 1) optionB.selected = true;
    selectA.appendChild(optionA);
    selectB.appendChild(optionB);
  });
  $("snell-n1").value = "1";
  $("snell-n2").value = "1.5";
}

function asinSafe(value) {
  if (value >= 1) return Math.PI / 2;
  if (value <= -1) return -Math.PI / 2;
  return Math.atan(value / Math.sqrt(1 - value * value));
}

function calculateSnell() {
  const n1 = parseNumber($("snell-n1").value, 1);
  const n2 = parseNumber($("snell-n2").value, 1.5);
  snell.angle = parseNumber($("snell-angle").value, snell.angle);
  $("snell-angle-range").value = String(snell.angle);
  $("snell-angle-value").textContent = `${snell.angle}°`;
  const theta = (snell.angle * Math.PI) / 180;
  const thetaRef = asinSafe((n1 / n2) * Math.sin(theta));
  $("snell-refr").value = formatNumber((thetaRef * 180) / Math.PI, 2);
  $("snell-refl").value = formatNumber(snell.angle, 2);
  const canvas = $("snell-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const zx = canvas.width / 2;
  const zy = canvas.height / 2;
  const amp = 200;
  ctx.strokeStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(50, zy);
  ctx.lineTo(canvas.width - 50, zy);
  ctx.moveTo(zx, 20);
  ctx.lineTo(zx, canvas.height - 20);
  ctx.stroke();
  ctx.fillStyle = n1 > n2 ? "rgba(180,225,255,0.45)" : "rgba(180,225,255,0.2)";
  ctx.fillRect(0, n1 > n2 ? 0 : zy, canvas.width, canvas.height / 2);
  ctx.strokeStyle = "#0050d0";
  ctx.beginPath();
  ctx.moveTo(zx, zy);
  ctx.lineTo(zx + amp * Math.sin(theta), zy - amp * Math.cos(theta));
  ctx.stroke();
  ctx.strokeStyle = "#008000";
  ctx.beginPath();
  ctx.moveTo(zx, zy);
  ctx.lineTo(zx - amp * Math.sin(theta), zy - amp * Math.cos(theta));
  ctx.stroke();
  const ratio = (n1 / n2) * Math.sin(theta);
  if (Math.abs(ratio) <= 1) {
    ctx.strokeStyle = "#c00000";
    ctx.beginPath();
    ctx.moveTo(zx, zy);
    ctx.lineTo(zx - amp * Math.sin(thetaRef), zy + amp * Math.cos(thetaRef));
    ctx.stroke();
    updateStatus(`Snell: ${formatNumber((thetaRef * 180) / Math.PI, 2)}°`);
  } else {
    updateStatus("Snell: reflexion total interna");
  }
}

function initSnell() {
  if (App.initialized.has("snell")) return;
  App.initialized.add("snell");
  populateSnellMaterials();
  $("snell-material-1").addEventListener("change", (event) => {
    $("snell-n1").value = event.target.value;
    calculateSnell();
  });
  $("snell-material-2").addEventListener("change", (event) => {
    $("snell-n2").value = event.target.value;
    calculateSnell();
  });
  $("snell-angle-range").addEventListener("input", (event) => {
    $("snell-angle").value = event.target.value;
    calculateSnell();
  });
  $("snell-angle").addEventListener("change", calculateSnell);
  $("snell-n1").addEventListener("change", calculateSnell);
  $("snell-n2").addEventListener("change", calculateSnell);
  $("snell-calcular").addEventListener("click", calculateSnell);
  $("snell-animar").addEventListener("click", () => {
    snell.running = !snell.running;
    if (snell.running) {
      startTimer("snell", () => {
        snell.angle += 1;
        if (snell.angle > 89) snell.angle = -89;
        $("snell-angle").value = String(snell.angle);
        calculateSnell();
      }, 60);
    } else {
      stopTimer("snell");
    }
  });
  calculateSnell();
}

function initNavigation() {
  document.querySelectorAll(".nav-button[data-sim]").forEach((button) => {
    button.addEventListener("click", () => setActiveSimulation(button.dataset.sim));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLongitudinal();
  initTransversal();
  initLissajous();
  initPendulo();
  initOrbitas();
  initViscoso();
  initSnell();
  setActiveSimulation("longitudinal");
});
