"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const SIZE = 360; // canvas px; the head itself is about 200px tall

/** Chrome head that follows the pointer, floats and blinks. Calls onFail when WebGL is unavailable. */
export default function ChromeBot({ onFail }: { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { onFail(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(SIZE, SIZE);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.z = 8.06;

    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07 });
    const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x040405, metalness: 0.3, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
    const bot = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), chrome); head.scale.set(1.1, 1, 0.98);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, Math.PI / 2 - 1.02, 2.04, Math.PI / 2 - 0.5, 1.0), visorMat); visor.scale.set(1.1 * 1.015, 1.015, 0.98 * 1.015); visor.rotation.y = 0;
    const eyes = new THREE.Group();
    [-0.3, 0.3].forEach((x) => { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 8, 16), eyeMat); e.position.set(x, 0.03, 0.97); e.scale.z = 0.45; eyes.add(e); });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 16), chrome); stem.position.y = 1.15;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), chrome); ball.position.y = 1.38;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 16, 64), chrome); halo.position.y = -1.28; halo.rotation.x = 0.92 * Math.PI / 2;
    const ears = [-1.1, 1.1].map((x) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 16, 32), chrome); t.position.x = x; t.rotation.y = Math.PI / 2; return t; });
    bot.add(head, visor, eyes, stem, ball, halo, ...ears);
    scene.add(bot);

    const target = { x: -0.3, y: 0.3 }; // looks up and right until the pointer moves
    const move = (e: PointerEvent) => {
      target.x = THREE.MathUtils.clamp(((e.clientY - innerHeight / 2) / (innerHeight / 2)) * 0.62, -0.62, 0.62);
      target.y = THREE.MathUtils.clamp(((e.clientX - innerWidth / 2) / (innerWidth / 2)) * 0.59, -0.59, 0.59);
    };
    window.addEventListener("pointermove", move);

    let raf = 0, visible = true, t0 = performance.now(), phase = 0, nextBlink = 3 + Math.random() * 2, blinkAt = -1;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05), now = (performance.now() - t0) / 1000;
      const k = 1 - Math.pow(1 - 0.08, 60 * dt);
      bot.rotation.x += (target.x - bot.rotation.x) * k;
      bot.rotation.y += (target.y - bot.rotation.y) * k;
      phase += dt * 1.5;
      bot.position.y += (Math.sin(phase) * 0.2 - bot.position.y) * k;
      halo.rotation.z += dt * 0.35;
      if (now > nextBlink) { blinkAt = now; nextBlink = now + 3 + Math.random() * 2; }
      const b = blinkAt < 0 ? 0 : (now - blinkAt) / 0.18;
      eyes.scale.y = b >= 0 && b < 2 ? 1 - 0.9 * (1 - Math.abs(b - 1)) : 1;
      renderer.render(scene, camera);
    };
    tick();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("pointermove", move);
      scene.traverse((o: any) => { o.geometry?.dispose?.(); });
      [chrome, visorMat, eyeMat].forEach((m) => m.dispose());
      pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [onFail]);

  return <div ref={host} className="pointer-events-none h-[360px] w-[360px]" aria-hidden="true" />;
}
