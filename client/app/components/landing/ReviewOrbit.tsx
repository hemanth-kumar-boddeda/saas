"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ORBIT_ITEMS, OrbitItem } from "./reviewItems";

const PLANES = 16; // 8 clips x 2 plane sets share video textures
const RADIUS = 260;
const SIZE = 118;

/** Product chrome painted once on a transparent canvas: version chip, scrub bar, comment pins. */
const chrome = (it: OrbitItem) => {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 360;
  const g = c.getContext("2d")!;
  const bar = g.createLinearGradient(0, 270, 0, 360);
  bar.addColorStop(0, "rgba(0,0,0,0)"); bar.addColorStop(1, "rgba(0,0,0,.65)");
  g.fillStyle = bar; g.fillRect(0, 270, 640, 90);
  g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(28, 322, 584, 6);
  g.fillStyle = "#7c5cff"; g.fillRect(28, 322, 584 * 0.42, 6);
  it.pins.forEach((p) => { g.fillStyle = "#fbbf24"; g.beginPath(); g.arc(28 + 584 * p, 325, 9, 0, 7); g.fill(); });
  g.fillStyle = "rgba(12,12,13,.7)"; g.beginPath(); g.roundRect(24, 22, 92, 40, 20); g.fill();
  g.fillStyle = "#ededeb"; g.font = "600 22px Geist, system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText(`v${it.version}`, 46, 43);
  g.font = "600 26px Geist, system-ui, sans-serif"; g.fillText(it.title, 28, 292);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/**
 * Sphere of sample reviews. Drag to spin (inertia), hover for a caption, click to open one.
 * Desktop only; the parent shows a static grid on phones and for reduced motion.
 */
export default function ReviewOrbit({ onOpen, onFail }: { onOpen: (i: number) => void; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<OrbitItem | null>(null);

  useEffect(() => {
    const el = host.current!;
    let W = el.clientWidth, H = el.clientHeight;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onFail(); // no WebGL (blocked, old GPU): the parent shows the static grid instead
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 12;
    const worldPerPx = () => (2 * 12 * Math.tan(Math.PI / 6)) / H;
    const group = new THREE.Group();
    const scene = new THREE.Scene();
    scene.add(group);

    const videos = ORBIT_ITEMS.map((it) => {
      const v = document.createElement("video");
      Object.assign(v, { src: `/samples/clip${it.clip}.mp4`, muted: true, loop: true, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
      v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace;
      return { v, tex };
    });
    const overlays = ORBIT_ITEMS.map(chrome);

    const planes: THREE.Group[] = [];
    const hit: THREE.Mesh[] = [];
    for (let i = 0; i < PLANES; i++) {
      const k = i % ORBIT_ITEMS.length;
      const y = i * (2 / PLANES) - 1 + 1 / PLANES, r = Math.sqrt(1 - y * y), a = Math.PI * (3 - Math.sqrt(5)) * i;
      const holder = new THREE.Group();
      holder.userData = { k, base: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(RADIUS) };
      const mk = (map: THREE.Texture, z: number, transparent: boolean) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 9 / 16), new THREE.MeshBasicMaterial({ map, transparent, depthWrite: false, side: THREE.DoubleSide }));
        m.position.z = z; holder.add(m); return m;
      };
      const base = mk(videos[k].tex, 0, true);
      mk(overlays[k], 0.001, true);
      base.userData.k = k; hit.push(base); planes.push(holder); group.add(holder);
    }
    const layout = () => {
      const s = worldPerPx();
      planes.forEach((p) => { p.position.copy(p.userData.base).multiplyScalar(s); p.scale.setScalar(SIZE * s); });
    };
    layout();

    const play = (on: boolean) => videos.forEach(({ v }) => (on ? v.play().catch(() => {}) : v.pause()));
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    let vel = { x: 0, y: 0 }, drag = false, moved = 0, last = { x: 0, y: 0 }, auto = true, raf = 0, visible = true, hovered = -1;
    const q = new THREE.Quaternion(), axisY = new THREE.Vector3(0, 1, 0), axisX = new THREE.Vector3(1, 0, 0);

    const pick = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const h = ray.intersectObjects(hit)[0];
      return h ? (h.object.userData.k as number) : -1;
    };
    const down = (e: PointerEvent) => { drag = true; moved = 0; auto = false; last = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); renderer.domElement.style.cursor = "grabbing"; };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        vel.x += dx * 0.001; vel.y += dy * 0.001; moved += Math.abs(dx) + Math.abs(dy); last = { x: e.clientX, y: e.clientY };
        return;
      }
      const k = pick(e);
      if (k !== hovered) { hovered = k; setHover(k >= 0 ? ORBIT_ITEMS[k] : null); }
      renderer.domElement.style.cursor = k >= 0 ? "pointer" : "grab";
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      drag = false; renderer.domElement.style.cursor = "grab";
      if (moved < 6) { const k = pick(e); if (k >= 0) onOpen(k); }
    };
    const cv = renderer.domElement;
    cv.style.cursor = "grab"; cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      if (auto) vel.x += 0.0006;
      vel.x *= 0.94; vel.y *= 0.94;
      q.setFromAxisAngle(axisY, vel.x).multiply(new THREE.Quaternion().setFromAxisAngle(axisX, vel.y));
      group.quaternion.premultiply(q);
      const inv = group.quaternion.clone().invert();
      planes.forEach((p) => p.quaternion.copy(inv)); // always face the camera
      renderer.render(scene, camera);
    };
    play(true);
    tick();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; play(visible); });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      W = el.clientWidth; H = el.clientHeight;
      renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); layout();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); play(false);
      cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up);
      videos.forEach(({ v, tex }) => { tex.dispose(); v.removeAttribute("src"); v.load(); });
      overlays.forEach((t) => t.dispose());
      planes.forEach((p) => p.children.forEach((m: any) => { m.geometry.dispose(); m.material.dispose(); }));
      renderer.dispose(); cv.remove();
    };
  }, [onOpen, onFail]);

  return (
    <div className="relative">
      <div ref={host} className="h-[560px] w-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex min-h-[44px] flex-col items-center justify-end text-center" aria-live="polite">
        {hover ? (
          <>
            <span className="text-[13px] font-medium text-cf-text">{hover.title}</span>
            <span className="font-[family-name:var(--font-newsreader)] text-[14px] text-cf-muted">{hover.meta}</span>
          </>
        ) : (
          <span className="text-[10px] uppercase tracking-[.24em] text-cf-muted">Drag to explore</span>
        )}
      </div>
    </div>
  );
}
