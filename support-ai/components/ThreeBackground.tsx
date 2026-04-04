"use client";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Neural Constellation Background
 * A high-end particle network that represents "intelligence" and "connectivity".
 */
export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const W = window.innerWidth, H = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 0); // Transparent to show CSS gradients if any
    mountRef.current.appendChild(renderer.domElement);

    // Dynamic Particle System
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

        velocities[i * 3] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.25,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Line Network (Constellation)
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.15
    });

    let lineMesh: THREE.LineSegments | null = null;

    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / W - 0.5) * 2;
        mouse.y = (e.clientY / H - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

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

        const currentPos = geometry.attributes.position.array as Float32Array;
        
        // Update particles
        for (let i = 0; i < particleCount; i++) {
            currentPos[i * 3] += velocities[i * 3];
            currentPos[i * 3 + 1] += velocities[i * 3 + 1];
            currentPos[i * 3 + 2] += velocities[i * 3 + 2];

            // Boundary check
            if (Math.abs(currentPos[i * 3]) > 45) velocities[i * 3] *= -1;
            if (Math.abs(currentPos[i * 3 + 1]) > 35) velocities[i * 3 + 1] *= -1;
            if (Math.abs(currentPos[i * 3 + 2]) > 25) velocities[i * 3 + 2] *= -1;
        }
        geometry.attributes.position.needsUpdate = true;

        // Build lines based on distance
        if (lineMesh) scene.remove(lineMesh);
        
        const linePositions: number[] = [];
        const maxDist = 14;
        
        for (let i = 0; i < particleCount; i++) {
            for (let j = i + 1; j < particleCount; j++) {
                const dx = currentPos[i * 3] - currentPos[j * 3];
                const dy = currentPos[i * 3 + 1] - currentPos[j * 3 + 1];
                const dz = currentPos[i * 3 + 2] - currentPos[j * 3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < maxDist * maxDist) {
                    linePositions.push(currentPos[i * 3], currentPos[i * 3 + 1], currentPos[i * 3 + 2]);
                    linePositions.push(currentPos[j * 3], currentPos[j * 3 + 1], currentPos[j * 3 + 2]);
                }
            }
        }

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
        lineMesh = new THREE.LineSegments(lineGeo, lineMaterial);
        scene.add(lineMesh);

        // Smooth camera movement
        camera.position.x += (mouse.x * 5 - camera.position.x) * 0.05;
        camera.position.y += (-mouse.y * 4 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    };
    animate();

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div 
        ref={mountRef} 
        style={{ 
            position: "fixed", inset: 0, zIndex: -1, 
            pointerEvents: "none",
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" 
        }} 
    />
  );
}
