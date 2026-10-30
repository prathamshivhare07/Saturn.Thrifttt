import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// 3D Model URLs in public directory
const RACK_MODEL_URL = '/models/clothes_rack.glb';
const HOODIE_MODEL_URL = '/models/hoodie.glb';

// Pre-load the models
useGLTF.preload(RACK_MODEL_URL);
useGLTF.preload(HOODIE_MODEL_URL);

// 3D Clothing Rack Model from src/assets/clothes+rack+3d+model.glb
export function LuxuryClothingRack() {
  const { scene } = useGLTF(RACK_MODEL_URL);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Scale so rack height is ~2.5 units
    const targetHeight = 2.5;
    const rawHeight = size.y > 0.001 ? size.y : 1;
    const scaleFactor = targetHeight / rawHeight;

    const wrapper = new THREE.Group();

    // Center on X and Z, place base feet at y = 0
    clone.position.x = -center.x;
    clone.position.y = -box.min.y;
    clone.position.z = -center.z;

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    // Change to: (1.35 makes the horizontal rail 35% wider!)
    wrapper.scale.set(scaleFactor * 1.35, scaleFactor, scaleFactor);

    wrapper.add(clone);
    return wrapper;
  }, [scene]);

  return (
    <group position={[0, 0, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Single Luxury Hanger Component
export function LuxuryHanger({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const woodMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1A1817', // Matte Black sculpted luxury hanger
        roughness: 0.4,
        metalness: 0.1,
      }),
    []
  );

  const hookMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#D4AF37', // Gold metal hook
        roughness: 0.2,
        metalness: 0.95,
      }),
    []
  );

  return (
    <group position={position} rotation={rotation}>
      {/* Hook hanging on top rail */}
      <mesh position={[0, 0.09, 0]} material={hookMaterial}>
        <torusGeometry args={[0.045, 0.006, 12, 24, Math.PI * 1.3]} />
      </mesh>
      {/* Hook stem */}
      <mesh position={[0.035, 0.03, 0]} material={hookMaterial}>
        <cylinderGeometry args={[0.006, 0.006, 0.07, 16]} />
      </mesh>
      {/* Sloping Wooden Hanger Arms (compact to remain cleanly inside the collar/shoulders) */}
      <mesh position={[-0.11, -0.04, 0]} rotation={[0, 0, -0.28]} material={woodMaterial}>
        <boxGeometry args={[0.22, 0.02, 0.02]} />
      </mesh>
      <mesh position={[0.11, -0.04, 0]} rotation={[0, 0, 0.28]} material={woodMaterial}>
        <boxGeometry args={[0.22, 0.02, 0.02]} />
      </mesh>
    </group>
  );
}

// Procedural Fallback Garment (rendered if model is loading)
function ProceduralGarmentShape({ color = '#242328' }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  return (
    <group position={[0, -0.7, 0]}>
      {/* Main Body */}
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={[0.62, 1.1, 0.12]} />
      </mesh>
      {/* Left Shoulder Sleeve */}
      <mesh position={[-0.34, 0.2, 0]} rotation={[0, 0, 0.35]} material={material}>
        <boxGeometry args={[0.22, 0.65, 0.11]} />
      </mesh>
      {/* Right Shoulder Sleeve */}
      <mesh position={[0.34, 0.2, 0]} rotation={[0, 0, -0.35]} material={material}>
        <boxGeometry args={[0.22, 0.65, 0.11]} />
      </mesh>
    </group>
  );
}

// Interactive Hanging Garment Slot
function HangingGarmentSlot({
  category,
  slotIndex,
  totalSlots,
  activeCategory = 'all',
  hoveredIndex,
  setHoveredIndex,
  onSelectCategory,
  sceneTemplate,
}) {
  const groupRef = useRef();
  const isHovered = hoveredIndex === slotIndex;
  const isSelected = activeCategory === category.id;

  // 5 slots spaced comfortably across the rack model width
  const spacing = 0.38;
  const baseX = (slotIndex - (totalSlots - 1) / 2) * spacing;

  // Normalized hoodie model scaled to fit proportionally on the rack
  const normalizedScene = useMemo(() => {
    if (!sceneTemplate) return null;

    const clone = sceneTemplate.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Target height for a substantial streetwear hoodie: 1.18 units
    const targetHeight = 1.18;
    const rawHeight = size.y > 0.0001 ? size.y : 0.0101169;
    const scaleFactor = targetHeight / rawHeight;

    const wrapper = new THREE.Group();

    // Center model on X and Z, and align top collar with hanger hook
    clone.position.x = -center.x;
    clone.position.y = -box.max.y + rawHeight * 0.08;
    clone.position.z = -center.z;

    const tintColors = {
      tees: new THREE.Color('#242328'),
      jackets: new THREE.Color('#9e632e'),
      denim: new THREE.Color('#416386'),
      knits: new THREE.Color('#4e5b41'),
      hoodies: new THREE.Color('#212d40'),
    };
    const targetTint = category.color
      ? new THREE.Color(category.color)
      : tintColors[category.id] || new THREE.Color('#2B2D31');

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.side = THREE.DoubleSide;
          child.material.roughness = 0.65;
          child.material.metalness = 0.12;
          if (child.material.color) {
            child.material.color.lerp(targetTint, 0.45);
          }
        }
      }
    });

    wrapper.scale.setScalar(scaleFactor);
    wrapper.add(clone);

    return wrapper;
  }, [sceneTemplate, category]);

  // Space-making animation: Adjacent items shift left/right when an item is hovered
  let targetXOffset = 0;
  if (hoveredIndex !== null) {
    if (slotIndex < hoveredIndex) {
      targetXOffset = -0.14; // Shift left
    } else if (slotIndex > hoveredIndex) {
      targetXOffset = 0.14; // Shift right
    }
  }

  // Smooth, weighted luxury animation on hover
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Gentle organic breathing sway when idle
    const idleSway = Math.sin(state.clock.elapsedTime * 1.5 + slotIndex * 1.2) * 0.02;

    // When hovered or selected:
    // 1. Step forward towards viewer in Z
    const targetZ = isHovered ? 0.45 : isSelected ? 0.22 : 0;
    // 2. Lift slightly in Y off the rail
    const targetY = isHovered ? 2.41 : isSelected ? 2.38 : 2.35;
    // 3. Rotate smoothly to face front (+Z):
    const targetRotY = isHovered
      ? Math.PI
      : isSelected
        ? Math.PI * 0.72
        : Math.PI * 0.55 + idleSway;
    const targetX = baseX + targetXOffset;

    const dampSpeed = 4.2;

    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      targetX,
      dampSpeed,
      delta
    );

    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      targetY,
      dampSpeed,
      delta
    );

    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z,
      targetZ,
      dampSpeed,
      delta
    );

    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetRotY,
      dampSpeed,
      delta
    );

    const targetScale = isHovered ? 1.05 : 1.0;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, dampSpeed, delta)
    );
  });

  return (
    <group
      ref={groupRef}
      position={[baseX, 2.35, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.pointerType === 'touch') {
          if (hoveredIndex === slotIndex) {
            onSelectCategory(category);
          } else {
            setHoveredIndex(slotIndex);
          }
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredIndex(slotIndex);
        document.body.style.cursor = 'pointer';
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (hoveredIndex !== slotIndex) {
          setHoveredIndex(slotIndex);
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (e.pointerType !== 'touch' && hoveredIndex === slotIndex) {
          setHoveredIndex(null);
        }
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.pointerType !== 'touch') {
          onSelectCategory(category);
        }
      }}
    >
      {/* Luxury Hanger */}
      <LuxuryHanger position={[0, -0.04, 0]} />

      {/* Hanging Garment Model or Procedural Fallback */}
      <group position={[0, -0.04, 0]}>
        {normalizedScene ? (
          <primitive object={normalizedScene} />
        ) : (
          <ProceduralGarmentShape color={category.color} />
        )}
      </group>

      {/* Generous Responsive Raycast Hit Box */}
      <mesh position={[0, -0.68, 0]} visible={false}>
        <boxGeometry args={[0.82, 1.55, 0.7]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

// Master Standing Hanger with Entrance Animation, Cursor Tracking, and Scroll Disappearance
export function HangerShowroom({
  categories,
  activeCategory = 'all',
  hoveredIndex,
  setHoveredIndex,
  onSelectCategory,
  mousePosRef,
  heroScrollFraction = 0,
}) {
  const { scene } = useGLTF(HOODIE_MODEL_URL);
  const rackMasterRef = useRef();
  const entranceProgressRef = useRef(0);

  useFrame((state, delta) => {
    if (!rackMasterRef.current) return;

    const viewport = state.viewport;

    // Compute responsive base fit scale so full hanger is visible
    const fitScale = Math.min(
      1.0,
      (viewport.width * 0.92) / 3.8,
      (viewport.height * 0.86) / 2.3
    );

    // 1. Entrance Animation Interpolation (glides smoothly from 0 to 1 on mount)
    entranceProgressRef.current = THREE.MathUtils.damp(
      entranceProgressRef.current,
      1,
      2.6,
      delta
    );
    const entrance = entranceProgressRef.current;
    const entranceYOffset = (1 - entrance) * -0.65;
    const entranceScale = 0.82 + entrance * 0.18;

    // 2. Cursor Interactivity (soft 3D tilt towards mouse with damping)
    const mouseX = mousePosRef?.current?.x || 0;
    const mouseY = mousePosRef?.current?.y || 0;

    // Gentle organic ambient breathing sway
    const time = state.clock.elapsedTime;
    const idleYaw = Math.sin(time * 0.9) * 0.02;
    const idlePitch = Math.cos(time * 0.7) * 0.012;

    const targetRotY = mouseX * 0.24 + idleYaw;
    const targetRotX = -mouseY * 0.14 + idlePitch;
    const targetParallaxX = mouseX * 0.12;
    const targetParallaxY = mouseY * 0.08;

    // 3. Clean In-Place Disappearance (rack remains locked in place without drifting or moving sideways)
    const targetX = targetParallaxX;
    const targetY = -1.54 + entranceYOffset + targetParallaxY;
    const targetZ = 0;
    const finalTargetScale = fitScale * entranceScale;

    // Smooth physics damping
    const dampSpeed = 4.8;
    rackMasterRef.current.position.x = THREE.MathUtils.damp(
      rackMasterRef.current.position.x,
      targetX,
      dampSpeed,
      delta
    );

    rackMasterRef.current.position.y = THREE.MathUtils.damp(
      rackMasterRef.current.position.y,
      targetY,
      dampSpeed,
      delta
    );

    rackMasterRef.current.position.z = THREE.MathUtils.damp(
      rackMasterRef.current.position.z,
      targetZ,
      dampSpeed,
      delta
    );

    rackMasterRef.current.rotation.y = THREE.MathUtils.damp(
      rackMasterRef.current.rotation.y,
      targetRotY,
      dampSpeed,
      delta
    );

    rackMasterRef.current.rotation.x = THREE.MathUtils.damp(
      rackMasterRef.current.rotation.x,
      targetRotX,
      dampSpeed,
      delta
    );

    const currentScale = rackMasterRef.current.scale.x;
    const nextScale = THREE.MathUtils.damp(currentScale, finalTargetScale, dampSpeed, delta);
    rackMasterRef.current.scale.set(nextScale, nextScale, nextScale);
  });

  return (
    <group ref={rackMasterRef} position={[0, -1.25, 0]}>
      {/* Luxury Matte Black & Gold Tubular Standing Clothing Rack */}
      <LuxuryClothingRack />

      {/* 5 Hanging Garments across the rack */}
      {categories.map((category, index) => (
        <HangingGarmentSlot
          key={category.id}
          category={category}
          slotIndex={index}
          totalSlots={categories.length}
          activeCategory={activeCategory}
          hoveredIndex={hoveredIndex}
          setHoveredIndex={setHoveredIndex}
          onSelectCategory={onSelectCategory}
          sceneTemplate={scene}
        />
      ))}
    </group>
  );
}

// Fallback Rack while 3D Model loads
function HangerLoadingFallback({ categories = [] }) {
  return (
    <group position={[0, -1.25, 0]}>
      <LuxuryClothingRack />
      {categories.map((category, index) => (
        <group key={category.id} position={[(index - (categories.length - 1) / 2) * 0.38, 2.35, 0]}>
          <LuxuryHanger position={[0, -0.04, 0]} />
          <ProceduralGarmentShape color={category.color} />
        </group>
      ))}
    </group>
  );
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('3D Clothing Rack render warning:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rack-canvas-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#7d7569', fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.15em' }}>
            ✦ ARCHIVAL SHOWROOM DISPLAY ✦
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Master Export Component: HeroClothingRack
function HeroClothingRackInner({
  categories = [],
  activeCategory = 'all',
  onSelectCategory = () => { },
  heroScrollFraction = 0,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Track cursor coordinates across the container for subtle 3D parallax tilt
  const handlePointerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mousePosRef.current = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
  };

  const handlePointerLeave = () => {
    mousePosRef.current = { x: 0, y: 0 };
    setHoveredIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="rack-canvas-wrapper"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0.15, 4.3], fov: 43 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Archival Studio Lights */}
        <ambientLight intensity={1.15} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.9}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.7} color="#fff1e6" />
        <spotLight
          position={[0, 4.5, 3]}
          intensity={1.3}
          angle={0.65}
          penumbra={0.8}
          color="#ffd6a5"
        />

        {/* Dynamic Soft Contact Shadow on Ground */}
        <ContactShadows
          position={[0, -1.14, 0]}
          opacity={0.62}
          scale={5.2}
          blur={2.4}
          far={3.8}
          color="#1a1816"
        />

        {/* 3D Clothing Rack Showroom with Suspense fallback */}
        <Suspense fallback={<HangerLoadingFallback categories={categories} />}>
          <HangerShowroom
            categories={categories}
            activeCategory={activeCategory}
            hoveredIndex={hoveredIndex}
            setHoveredIndex={setHoveredIndex}
            onSelectCategory={onSelectCategory}
            mousePosRef={mousePosRef}
            heroScrollFraction={heroScrollFraction}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function HeroClothingRack(props) {
  return (
    <CanvasErrorBoundary>
      <HeroClothingRackInner {...props} />
    </CanvasErrorBoundary>
  );
}

export default HeroClothingRack;
