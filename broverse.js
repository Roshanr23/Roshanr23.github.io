// A pocket Bro-verse for the Bro card: four of the characters wander, meet, wave, chat and jump.
// Click one (or its name chip) to see its special move. Adapted from bro-verse/web/index.html.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.getElementById("bro-world");
const statusEl = document.getElementById("bro-status");
const caption = document.getElementById("bro-caption");
const chipsEl = document.getElementById("bro-chips");
const fallback = document.getElementById("bro-static");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Each character stands for a real part of Bro's agent (from bro-verse's own role notes).
const ROLES = {
  bro: { color: "#A98CDD", role: "Main agent", tap: "who needs what?", desc: "You only ever talk to Bro. He sends the right friend for each job and tells you when it's done." },
  astro: { color: "#3E6EE0", role: "Browser", tap: "Canvas? on it.", desc: "Logs into sites and works them like you would: clicks, types and reads the page." },
  star: { color: "#F7D23E", role: "Search", tap: "found last year's midterm!", desc: "Finds past exams, notes, office hours and anything else on the web." },
  sprout: { color: "#79C9A0", role: "Memory", tap: "I know your whole schedule.", desc: "Keeps your profile: classes, schedule, and your usual order." },
  triangle: { color: "#8F6BDA", role: "Plans", tap: "step one: a plan.", desc: "Turns a goal into a plan with checkpoints." },
  cloud: { color: "#A9C2F2", role: "Check-ins", tap: "brief goes out at 7:45...", desc: "Sleeps until it's time: the morning brief, the night-before-deadline nudge." },
  cat: { color: "#B48CE6", role: "Logins & cards", tap: "your logins are safe.", desc: "Guards your logins and cards and only unlocks what a step needs." },
  mushroom: { color: "#E8705F", role: "Files", tap: "one folder per class!", desc: "Keeps a folder for every class, sorted as files come in." },
};
const CHAT = {
  bro: ["who needs what?", "nice work, team", "on it"],
  astro: ["Canvas moved a button again", "so many tabs", "logged in!"],
  star: ["found it!", "office hours are 3 to 5", "these notes are AMAZING"],
  sprout: ["midterm is tuesday", "noted your schedule", "you like extra salsa"],
  triangle: ["3 study sessions, planned", "precisely on track", "step one: flashcards"],
  cloud: ["five more minutes...", "zzz... deadline tomorrow", "brief at 7:45"],
  cat: ["passwords locked up", "you're welcome", "$6 left for snacks"],
  mushroom: ["filed your slides", "HW3.pdf is safe", "one folder per class"],
};
const HI = ["hey!", "yo", "hi hi", "sup"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

let renderer, scene, camera, clock;
const agents = [];
const area = { x: 2.6, z: 1.2 };
const SIZE = 0.68;   // characters are authored ~2.5 m tall; shrink them to fit a card
let now = 0, nextMeet = 2.5, loaded = false, loading = false, visible = false;
const timers = [];
const wait = (s) => new Promise((r) => timers.push({ at: now + s, r }));

class Agent {
  constructor(meta, gltf) {
    this.slug = meta.slug; this.meta = meta; this.role = ROLES[meta.slug];
    this.root = gltf.scene;
    this.root.userData.agent = this;
    this.root.scale.setScalar(SIZE);
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.radius = Math.max(0.7, meta.width * 0.4) * SIZE;
    this.height = meta.height * SIZE;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null; this.target = null; this.faceTo = null; this.busy = null; this.next = rand(0.5, 3);
    this.speed = rand(0.75, 0.95);
    this.bubble = document.createElement("div");
    this.bubble.className = "bro-bubble";
    this.bubble.hidden = true;
    stage.appendChild(this.bubble);
    this.bubbleUntil = 0;
    this.play("Idle", 0);
    this.actions.Idle.time = Math.random() * 3;
  }
  get pos() { return this.root.position; }
  play(name, fade = 0.3) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }
  clipLength(name) { return this.actions[name]?.getClip().duration ?? 1.5; }
  goTo(x, z, cb) { this.target = { x, z, cb }; this.faceTo = null; this.play("Walk", 0.25); }
  walk(x, z) {
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    return Promise.race([new Promise((r) => this.goTo(x, z, r)), wait(d / this.speed + 3)])
      .then(() => { if (this.target) { this.target = null; this.play("Idle", 0.3); } });
  }
  stop() { if (this.target) { this.target = null; this.play("Idle", 0.3); } }
  face(o) { this.faceTo = o.pos ? { x: o.pos.x, z: o.pos.z } : o; }
  say(text, ms = 2200) {
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.bubble.style.opacity = "1";
    this.bubbleUntil = now + ms / 1000;
  }
  update(dt) {
    let yaw = null;
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { const cb = this.target.cb; this.target = null; this.play("Idle", 0.3); cb?.(); }
      else {
        const s = Math.min(d, this.speed * dt);
        this.pos.x += dx / d * s; this.pos.z += dz / d * s;
        yaw = Math.atan2(dx, dz);
      }
    }
    // faceExact: look straight at the viewer; otherwise cheat toward the camera so faces stay visible
    if (yaw === null && this.faceTo) yaw = Math.atan2(this.faceTo.x - this.pos.x, this.faceTo.z - this.pos.z) * (this.faceExact ? 1 : 0.7);
    if (yaw === null) yaw = this.root.rotation.y * 0.97;          // drift back toward facing the viewer
    const diff = Math.atan2(Math.sin(yaw - this.root.rotation.y), Math.cos(yaw - this.root.rotation.y));
    this.root.rotation.y += diff * Math.min(1, dt * (this.faceExact ? 9 : 7));
    this.mixer.update(dt);
    if (!this.bubble.hidden && now > this.bubbleUntil) {
      this.bubble.style.opacity = "0";
      if (now > this.bubbleUntil + 0.3) this.bubble.hidden = true;
    }
  }
  freeTime() {
    if (this.busy || this.target || now < this.next || reduce) return;
    const r = Math.random();
    if (r < 0.62) { const p = randomSpot(this); this.goTo(p.x, p.z, () => { this.next = now + rand(1.2, 3.5); }); }
    else if (r < 0.78) { this.play("Think", 0.35); this.next = now + rand(2.5, 4); }
    else { this.play("Idle", 0.35); this.next = now + rand(2, 4); }
  }
}

function randomSpot(me) {
  let best = null, room = -1;
  for (let i = 0; i < 8; i++) {
    const p = { x: rand(-area.x, area.x), z: rand(-area.z, area.z) };
    const r = Math.min(...agents.filter((a) => a !== me).map((a) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z)));
    if (r > room) { best = p; room = r; }
  }
  return best;
}

function release(token, ...list) {
  for (const a of list) if (a.busy === token) { a.busy = null; a.faceTo = null; a.faceExact = false; a.stop(); a.play("Idle", 0.35); a.next = now + rand(0.8, 2.5); }
}

// Two friends walk up to each other, wave, trade a line each, and jump.
async function meet(a, b) {
  const token = {};
  a.busy = b.busy = token;
  const live = () => a.busy === token && b.busy === token;
  const mx = THREE.MathUtils.clamp((a.pos.x + b.pos.x) / 2, -area.x + 1, area.x - 1);
  const mz = THREE.MathUtils.clamp((a.pos.z + b.pos.z) / 2, -area.z + 0.3, area.z - 0.3);
  const gap = (a.radius + b.radius) * 0.85 + 0.1, sx = b.pos.x >= a.pos.x ? 1 : -1;
  await Promise.all([a.walk(mx - sx * gap / 2, mz), b.walk(mx + sx * gap / 2, mz)]);
  if (!live()) return release(token, a, b);
  a.face(b); b.face(a); a.play("Wave"); b.play("Wave"); a.say(pick(HI), 1500);
  await wait(0.6); if (!live()) return release(token, a, b);
  b.say(pick(HI), 1300);
  await wait(1.2); if (!live()) return release(token, a, b);
  a.play("Talk"); b.play("Listen"); a.say(pick(CHAT[a.slug]), 2200);
  await wait(2.4); if (!live()) return release(token, a, b);
  b.play("Talk"); a.play("Listen"); b.say(pick(CHAT[b.slug]), 2200);
  await wait(2.4); if (!live()) return release(token, a, b);
  a.play("Jump", 0.15); b.play("Jump", 0.15);
  await wait(a.clipLength("Jump") + 0.1);
  release(token, a, b);
}

function smallTalk() {
  if (reduce || now < nextMeet) return;
  nextMeet = now + rand(3.5, 6);
  const free = agents.filter((a) => !a.busy);
  if (free.length < 2 || agents.some((a) => a.busy && typeof a.busy === "object")) return;
  const a = pick(free);
  const b = free.filter((x) => x !== a).sort((p, q) => p.pos.distanceTo(a.pos) - q.pos.distanceTo(a.pos))[0];
  meet(a, b);
}

// Clicked: turn to face the viewer, wave hello, then show off the special move.
async function show(a) {
  const token = {};
  for (const o of agents) if (o.busy && o.busy === a.busy && typeof o.busy === "object") release(o.busy, o);
  a.stop();
  a.busy = token;
  a.faceExact = true;
  a.face({ x: camera.position.x, z: camera.position.z });
  a.play("Wave", 0.15);
  a.say(`hi, I'm ${a.meta.name}!`, 1700);
  caption.innerHTML = "";
  const b = document.createElement("b"); b.textContent = `${a.meta.name} · ${a.role.role}`;
  const s = document.createElement("span"); s.textContent = ` ${a.role.desc} Special move: ${a.meta.special}.`;
  caption.append(b, s);
  chipsEl.querySelectorAll("button").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.slug === a.slug)));
  await wait(Math.max(1.6, a.clipLength("Wave")));
  if (a.busy !== token) return;
  a.play("Special", 0.2);
  a.say(a.role.tap, 1800);
  await wait(a.clipLength("Special") * (a.slug === "astro" || a.slug === "cloud" ? 1 : 2));
  release(token, a);
}

// Keep them from walking through each other or off the stage.
function separate() {
  for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
    const a = agents[i], b = agents[j];
    if (a.busy && a.busy === b.busy && typeof a.busy === "object") continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 0.001;
    const min = (a.radius + b.radius) * 0.8;
    if (d >= min) continue;
    const push = (min - d) / 2;
    a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
    b.pos.x += dx / d * push; b.pos.z += dz / d * push;
  }
  for (const a of agents) {
    a.pos.x = THREE.MathUtils.clamp(a.pos.x, -area.x - 0.6, area.x + 0.6);
    a.pos.z = THREE.MathUtils.clamp(a.pos.z, -area.z - 0.4, area.z + 0.6);
  }
}

function fit() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h || !renderer) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(0, 1.0, -0.2);
  const halfW = area.x + 1.3;
  const dist = Math.max(11, halfW / (Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect) * 0.98);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(0, 0.62, 1).normalize(), dist);
  camera.lookAt(target);
}

const tmp = new THREE.Vector3();
function placeBubbles() {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const a of agents) {
    if (a.bubble.hidden) continue;
    tmp.set(a.pos.x, a.pos.y + a.height + 0.3, a.pos.z).project(camera);
    a.bubble.style.left = ((tmp.x + 1) / 2 * w).toFixed(1) + "px";
    a.bubble.style.top = ((1 - tmp.y) / 2 * h).toFixed(1) + "px";
  }
}

function step(dt) {
  now += dt;
  for (let i = timers.length - 1; i >= 0; i--) if (now >= timers[i].at) { timers[i].r(); timers.splice(i, 1); }
  smallTalk();
  for (const a of agents) a.freeTime();
  for (const a of agents) a.update(dt);
  separate();
}

function hitAgent(e) {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  let o = ray.intersectObjects(agents.map((a) => a.root), true)[0]?.object;
  while (o && !o.userData.agent) o = o.parent;
  return o?.userData.agent || null;
}

async function load() {
  loading = true;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  clock = new THREE.Clock();

  const key = new THREE.DirectionalLight("#ffffff", 1.6);
  key.position.set(-5, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, far: 40 });
  scene.add(key);

  // A soft round stage that catches their shadows.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ color: "#2A2F35", roughness: 1 }));
  floor.scale.set(area.x + 1.15, area.z + 1.4, 1);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: "#BA0C2F", transparent: true, opacity: 0.8 }));
  rim.scale.copy(floor.scale); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.005;
  scene.add(rim);

  new ResizeObserver(fit).observe(stage);
  fit();

  const { characters } = await (await fetch("media/broverse/characters.json")).json();
  const loader = new GLTFLoader();
  let done = 0;
  const order = ["bro", "astro", "star", "mushroom"];   // four keeps the stage roomy
  const metas = order.map((s) => characters.find((c) => c.slug === s)).filter(Boolean);
  const gltfs = await Promise.all(metas.map((m) => loader.loadAsync(`media/broverse/${m.slug}.glb`).then((g) => {
    statusEl.textContent = `Loading the Bro-verse… ${++done}/${metas.length}`;
    return g;
  })));
  metas.forEach((meta, i) => {
    const a = new Agent(meta, gltfs[i]);
    a.pos.set((i / (metas.length - 1) - 0.5) * 2 * area.x, 0, i % 2 ? -0.6 : 0.8);
    scene.add(a.root);
    agents.push(a);
  });

  for (const a of agents) {
    const c = document.createElement("button");
    c.type = "button"; c.dataset.slug = a.slug; c.setAttribute("aria-pressed", "false");
    const dot = document.createElement("i"); dot.style.background = a.role.color;
    c.append(dot, document.createTextNode(a.meta.name));
    c.addEventListener("click", () => show(a));
    chipsEl.append(c);
  }

  renderer.domElement.addEventListener("pointermove", (e) => { stage.style.cursor = hitAgent(e) ? "pointer" : ""; });
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const a = hitAgent(e);
    if (a) show(a);
  });

  statusEl.hidden = true;
  loaded = true;
  if (visible) start();
}

function frame() {
  step(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  placeBubbles();
}
function start() { clock.getDelta(); renderer.setAnimationLoop(frame); }
function stop() { renderer?.setAnimationLoop(null); }

new IntersectionObserver(([e]) => {
  visible = e.isIntersecting;
  if (visible && !loading) load().catch(() => {
    statusEl.textContent = "The 3D characters couldn't load here.";
    renderer?.domElement.remove();
    fallback.hidden = false;
    stage.hidden = true;
  });
  if (loaded) (visible ? start : stop)();
}, { rootMargin: "300px" }).observe(stage);
