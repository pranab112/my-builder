import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const BaseCanvas: React.FC<{ 
  initScene: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => { animate: () => void, cleanup: () => void } 
}> = ({ initScene }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Setup
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const { animate, cleanup } = initScene(scene, camera, renderer);
    
    let frameId: number;
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      animate();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cleanup();
      cancelAnimationFrame(frameId);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [initScene]);

  return <div ref={mountRef} className="w-full h-full" />;
};

// 1. Designer: A smooth, lit product cube
export const DesignerPreview = () => (
  <BaseCanvas
    initScene={(scene, camera) => {
      camera.position.z = 3;
      
      const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x6366f1, // Indigo
        roughness: 0.3,
        metalness: 0.7 
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const light = new THREE.DirectionalLight(0xffffff, 2);
      light.position.set(2, 2, 5);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      return {
        animate: () => {
          mesh.rotation.x += 0.01;
          mesh.rotation.y += 0.015;
        },
        cleanup: () => {
          geometry.dispose();
          material.dispose();
        }
      };
    }}
  />
);

// 2. Builder: A technical wireframe structure
export const BuilderPreview = () => (
  <BaseCanvas
    initScene={(scene, camera) => {
      camera.position.z = 3.5;
      
      const geometry = new THREE.IcosahedronGeometry(1.1, 0);
      const edges = new THREE.EdgesGeometry(geometry);
      const material = new THREE.LineBasicMaterial({ color: 0x10b981 }); // Emerald
      const lines = new THREE.LineSegments(edges, material);
      
      // Inner mesh to block background slightly
      const innerMat = new THREE.MeshBasicMaterial({ color: 0x064e3b, transparent: true, opacity: 0.2 });
      const innerMesh = new THREE.Mesh(geometry, innerMat);
      
      scene.add(lines);
      scene.add(innerMesh);

      return {
        animate: () => {
          lines.rotation.x -= 0.005;
          lines.rotation.y += 0.01;
          innerMesh.rotation.x -= 0.005;
          innerMesh.rotation.y += 0.01;
          
          const scale = 1 + Math.sin(Date.now() * 0.002) * 0.05;
          lines.scale.set(scale, scale, scale);
        },
        cleanup: () => {
          geometry.dispose();
          edges.dispose();
          material.dispose();
          innerMat.dispose();
        }
      };
    }}
  />
);

// 3. Motion: Swirling particles
export const MotionPreview = () => (
  <BaseCanvas
    initScene={(scene, camera) => {
      camera.position.z = 4;
      
      const geometry = new THREE.BufferGeometry();
      const count = 40;
      const positions = new Float32Array(count * 3);
      
      for(let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 3;
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.PointsMaterial({ 
        color: 0xf43f5e, // Rose
        size: 0.15,
        transparent: true,
        opacity: 0.8
      });
      
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      return {
        animate: () => {
          points.rotation.y -= 0.01;
          points.rotation.z += 0.005;
          // Wobbly movement
          const time = Date.now() * 0.001;
          points.position.y = Math.sin(time) * 0.2;
        },
        cleanup: () => {
          geometry.dispose();
          material.dispose();
        }
      };
    }}
  />
);

// 4. Movie: Cinematic rings / Lens aperture
export const MoviePreview = () => (
  <BaseCanvas
    initScene={(scene, camera) => {
      camera.position.z = 3.5;
      
      const geometry = new THREE.TorusGeometry(0.8, 0.15, 8, 20);
      const material = new THREE.MeshStandardMaterial({ color: 0xa855f7 }); // Purple
      const ring1 = new THREE.Mesh(geometry, material);
      
      const geometry2 = new THREE.TorusGeometry(1.2, 0.05, 8, 20);
      const material2 = new THREE.MeshStandardMaterial({ color: 0xd8b4fe, wireframe: true });
      const ring2 = new THREE.Mesh(geometry2, material2);
      
      scene.add(ring1);
      scene.add(ring2);

      const light = new THREE.PointLight(0xffffff, 2);
      light.position.set(2, 2, 5);
      scene.add(light);

      return {
        animate: () => {
          ring1.rotation.x += 0.02;
          ring1.rotation.y += 0.01;
          
          ring2.rotation.x -= 0.01;
          ring2.rotation.y -= 0.02;
        },
        cleanup: () => {
          geometry.dispose();
          material.dispose();
          geometry2.dispose();
          material2.dispose();
        }
      };
    }}
  />
);
