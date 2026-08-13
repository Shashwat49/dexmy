import { useEffect, useRef } from "react";
import * as THREE from "three";

// Floating brand-colored geometry + chalk-dust particles, with the camera
// drifting toward the mouse for a parallax feel. Everything here is
// disposed on unmount so React StrictMode's double-mount in dev doesn't
// leak a second WebGL context.
export default function HeroScene() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 11);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    scene.add(new THREE.AmbientLight(0x9bafa0, 0.6));

    const redLight = new THREE.PointLight(0xe4271c, 6, 30);
    redLight.position.set(-6, 3, 6);
    scene.add(redLight);

    const goldLight = new THREE.PointLight(0xf0b429, 5, 30);
    goldLight.position.set(6, -2, 6);
    scene.add(goldLight);

    const objects = [];
    function addMesh(geometry, material, position, speed) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      scene.add(mesh);
      objects.push({ mesh, speed, seed: Math.random() * 100 });
      return mesh;
    }

    const chalkWire = new THREE.MeshBasicMaterial({ color: 0xf2ecdd, wireframe: true, transparent: true, opacity: 0.5 });
    const redSolid = new THREE.MeshStandardMaterial({ color: 0xe4271c, roughness: 0.35, metalness: 0.1, emissive: 0x5c0f0a, emissiveIntensity: 0.4 });
    const goldSolid = new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.3, metalness: 0.15, emissive: 0x5a3d09, emissiveIntensity: 0.35 });

    addMesh(new THREE.IcosahedronGeometry(1.1, 0), chalkWire, [-4.2, 1.6, -1], 0.28);
    addMesh(new THREE.TorusGeometry(1, 0.12, 12, 60), redSolid, [4.3, 1.8, -2], 0.22);
    addMesh(new THREE.TorusGeometry(0.6, 0.08, 10, 40), goldSolid, [-3.6, -2.1, 0], 0.35);
    addMesh(new THREE.OctahedronGeometry(0.55, 0), redSolid, [0.2, 3.2, -3], 0.4);

    const bookGroup = new THREE.Group();
    const pageGeo = new THREE.BoxGeometry(1.4, 0.06, 1.8);
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xf2ecdd, roughness: 0.6 });
    const pageL = new THREE.Mesh(pageGeo, pageMat);
    pageL.position.x = -0.7;
    pageL.rotation.z = 0.22;
    const pageR = new THREE.Mesh(pageGeo, pageMat);
    pageR.position.x = 0.7;
    pageR.rotation.z = -0.22;
    bookGroup.add(pageL, pageR);
    bookGroup.position.set(4.6, -2.2, -1.5);
    scene.add(bookGroup);
    objects.push({ mesh: bookGroup, speed: 0.18, seed: 12 });

    const dustCount = 140;
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xf0b429, size: 0.035, transparent: true, opacity: 0.6 }));
    scene.add(dust);

    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
    let animationId;

    function handleMouseMove(e) {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    container.addEventListener("mousemove", handleMouseMove);

    const clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;
      camera.position.x = targetX * 1.4;
      camera.position.y = -targetY * 0.9;
      camera.lookAt(0, 0, 0);

      objects.forEach(({ mesh, speed, seed }) => {
        mesh.rotation.x = t * speed * 0.6 + seed;
        mesh.rotation.y = t * speed + seed;
        mesh.position.y += Math.sin(t * 0.6 + seed) * 0.0018;
      });
      dust.rotation.y = t * 0.02;

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-[2]">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
