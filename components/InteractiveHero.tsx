import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const InteractiveHero: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- SETUP ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0f172a, 0.002); // Matches bg-slate-950

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- OBJECTS ---
    
    // 1. Particle Sphere
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for(let i = 0; i < particlesCount * 3; i++) {
        // Random distribution in a sphere
        const r = 15 + Math.random() * 5;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        
        posArray[i] = r * Math.sin(phi) * Math.cos(theta);     // x
        posArray[i+1] = r * Math.sin(phi) * Math.sin(theta);   // y
        posArray[i+2] = r * Math.cos(phi);                     // z
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.1,
        color: 0x6366f1, // Indigo
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const particleMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleMesh);

    // 2. Connecting Lines (Icosahedron)
    const geo2 = new THREE.IcosahedronGeometry(12, 1);
    const mat2 = new THREE.MeshBasicMaterial({ 
        color: 0x8b5cf6, // Violet
        wireframe: true, 
        transparent: true, 
        opacity: 0.05 
    });
    const wireframeMesh = new THREE.Mesh(geo2, mat2);
    scene.add(wireframeMesh);

    // --- INTERACTION ---
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // --- ANIMATION ---
    const clock = new THREE.Clock();

    const animate = () => {
        const elapsedTime = clock.getElapsedTime();

        targetX = mouseX * 0.5;
        targetY = mouseY * 0.5;

        // Smooth rotation based on mouse
        particleMesh.rotation.y += 0.05 * (targetX - particleMesh.rotation.y);
        particleMesh.rotation.x += 0.05 * (targetY - particleMesh.rotation.x);
        
        // Constant idle rotation
        particleMesh.rotation.z = elapsedTime * 0.05;

        wireframeMesh.rotation.x += 0.05 * (targetY - wireframeMesh.rotation.x);
        wireframeMesh.rotation.y += 0.05 * (targetX - wireframeMesh.rotation.y);
        wireframeMesh.rotation.z = -elapsedTime * 0.1;

        // Pulse effect
        const scale = 1 + Math.sin(elapsedTime * 0.5) * 0.05;
        particleMesh.scale.set(scale, scale, scale);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };

    animate();

    // --- RESIZE ---
    const handleResize = () => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
        renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />;
};
