"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = window.innerWidth, H = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
    camera.position.z = 28;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Soft floating lines — like ink strokes on paper
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xb8b0a5,
      transparent: true,
      opacity: 0.18,
    });

    const lineGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const points = [];
      const startX = (Math.random() - 0.5) * 90;
      const startY = (Math.random() - 0.5) * 60;
      const startZ = (Math.random() - 0.5) * 30;
      for (let j = 0; j < 8; j++) {
        points.push(new THREE.Vector3(
          startX + (Math.random() - 0.5) * 14,
          startY + (Math.random() - 0.5) * 14,
          startZ + (Math.random() - 0.5) * 8,
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      lineGroup.add(new THREE.Line(geo, lineMaterial));
    }
    scene.add(lineGroup);

    // Sparse dust particles — warm stone tone
    const DOTS = 420;
    const pos = new Float32Array(DOTS * 3);
    for (let i = 0; i < DOTS; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 110;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xc4bdb5,
      size: 0.28,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // Two large thin rings — editorial geometry
    const makeRing = (r: number, tube: number, color: number, opacity: number) => {
      const g = new THREE.TorusGeometry(r, tube, 16, 90);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
      return new THREE.Mesh(g, m);
    };

    const ring1 = makeRing(9, 0.05, 0x8e8680, 0.18);
    ring1.position.set(16, 4, -8);
    ring1.rotation.x = 0.5;
    scene.add(ring1);

    const ring2 = makeRing(6, 0.04, 0xa89e95, 0.13);
    ring2.position.set(-20, -5, -12);
    ring2.rotation.y = 0.7;
    scene.add(ring2);

    const mouse = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / W - 0.5) * 0.25;
      mouse.y = (e.clientY / H - 0.5) * 0.18;
    };
    window.addEventListener("mousemove", onMouse);

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      lineGroup.rotation.y += 0.00035;
      lineGroup.rotation.x += 0.00015;
      ring1.rotation.z += 0.0018;
      ring2.rotation.z -= 0.0012;
      camera.position.x += (mouse.x * 2.5 - camera.position.x) * 0.035;
      camera.position.y += (-mouse.y * 1.8 - camera.position.y) * 0.035;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
  );
}
