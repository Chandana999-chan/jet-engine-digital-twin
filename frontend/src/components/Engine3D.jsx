import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Center,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

function getHoveredName(object) {
  let current = object;

  while (current) {
    const name = current.name || "";

    if (
      name.startsWith("Marker_") ||
      name.startsWith("DGEN_") ||
      name.startsWith("Fan_") ||
      name.startsWith("LPC_") ||
      name.startsWith("HPC_") ||
      name.startsWith("HPT_") ||
      name.startsWith("LPT_") ||
      name.startsWith("Combustor_") ||
      name.startsWith("Combustion_") ||
      name.startsWith("Support_Ring") ||
      name === "Core_Shaft" ||
      name === "Nose_Cone" ||
      name === "Intake_Ring" ||
      name === "Exhaust_Cone" ||
      name === "Exhaust_Ring" ||
      name === "Bypass_Duct_Shell" ||
      name === "Outer_Nacelle_Full" ||
      name === "Outer_Nacelle_Cutaway_Final" ||
      name === "Vibration_Aura_Ring"
    ) {
      return name.replaceAll("_", " ");
    }

    current = current.parent;
  }

  return null;
}

function EngineModel({ onLoaded, onHover, viewMode }) {
  const { scene } = useGLTF("/models/AEROTWIN_Engine.glb");
  const modelRef = useRef();

  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
  const full =
    model.getObjectByName("Outer_Nacelle_Full");

  const cutaway =
    model.getObjectByName(
      "Outer_Nacelle_Cutaway_Final"
    );

    const vibrationRing =
  model.getObjectByName(
    "Vibration_Aura_Ring"
  );

  const ignoreForHover = [
  full,
  cutaway,
  vibrationRing,
  model.getObjectByName("Bypass_Duct_Shell"),
];

ignoreForHover.forEach((object) => {
  if (!object) return;

  object.traverse((child) => {
    if (child.isMesh) {
      child.raycast = () => {};
    }
  });
});

/* Ignore vibration ring for hover */
if (vibrationRing) {
  vibrationRing.traverse((child) => {
    if (child.isMesh) {
      child.raycast = () => null;
    }
  });
}

/* In Cutaway mode, let mouse pass through shell */
if (cutaway) {
  cutaway.traverse((child) => {
    if (child.isMesh) {
      if (viewMode === "cutaway") {
        child.raycast = () => null;
      } else {
        child.raycast =
          THREE.Mesh.prototype.raycast;
      }
    }
  });
}

  if (full) {
    full.visible = viewMode === "normal";
  }

  if (cutaway) {
    cutaway.visible = viewMode === "cutaway";
  }
}, [model, viewMode]);

  useEffect(() => {
    if (!modelRef.current) return;

    const box = new THREE.Box3().setFromObject(modelRef.current);
    const size = box.getSize(new THREE.Vector3());

    onLoaded?.(size);
  }, [model, onLoaded]);

  return (
    <Center>
      <primitive
  ref={modelRef}
  object={model}
  onPointerMove={(event) => {
  event.stopPropagation();

  let foundName = null;

  for (const hit of event.intersections) {
    const name = getHoveredName(hit.object);

    if (name) {
      foundName = name;
      break;
    }
  }

  onHover?.(foundName);
}}
  onPointerOut={() => {
    onHover?.(null);
  }}
/>
    </Center>
  );
}

function CameraSetup({ modelSize, controlsRef, resetKey }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (!modelSize) return;

    const maxDimension = Math.max(
      modelSize.x,
      modelSize.y,
      modelSize.z
    );

    const distance = Math.max(maxDimension * 2.2, 3);

    camera.position.set(
      distance * 0.8,
      distance * 0.45,
      distance * 1.2
    );

    camera.near = Math.max(maxDimension / 10000, 0.001);
    camera.far = Math.max(maxDimension * 100, 1000);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);

      // Allow much closer inspection.
      controlsRef.current.minDistance = Math.max(
        maxDimension * 0.01,
        0.02
      );

      controlsRef.current.maxDistance = Math.max(
        maxDimension * 10,
        20
      );

      controlsRef.current.update();
    }

    invalidate();
  }, [modelSize, camera, controlsRef, resetKey, invalidate]);

  return null;
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: "#dce7f5", fontSize: 13, whiteSpace: "nowrap" }}>
        Loading 3D engine...
      </div>
    </Html>
  );
}

export default function JetEngineModel() {
  const controlsRef = useRef();
  const [modelSize, setModelSize] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredPart, setHoveredPart] = useState(null);
  const [viewMode, setViewMode] = useState("cutaway"); // "normal" or "cutaway"

  const resetView = () => {
    setResetKey((value) => value + 1);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "450px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        background:
          "radial-gradient(circle at center, #17283b 0%, #09111e 75%)",
      }}
    >
      <Canvas
        camera={{ position: [4, 3, 6], fov: 45 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor("#09111e");
        }}
      >
        <ambientLight intensity={1.8} />

        <directionalLight
          position={[5, 8, 5]}
          intensity={2.5}
        />

        <directionalLight
          position={[-5, 2, -5]}
          intensity={1.2}
        />

        <Suspense fallback={<Loader />}>
          <EngineModel onLoaded={setModelSize}
           onHover={setHoveredPart}
           viewMode={viewMode} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableRotate
          enableZoom
          enablePan
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          zoomSpeed={1}
          rotateSpeed={0.8}
        />

        <CameraSetup
          modelSize={modelSize}
          controlsRef={controlsRef}
          resetKey={resetKey}
        />
      </Canvas>

    <div
  style={{
    position: "absolute",
    top: 12,
    left: 12,
    display: "flex",
    gap: 8,
    zIndex: 20,
  }}
>
  <button
    onClick={() =>
      setViewMode("normal")
    }
    style={{
      background:
        viewMode === "normal"
          ? "#1d6f86"
          : "#102334",
      color: "white",
      padding: "8px 12px",
      borderRadius: "8px",
      border:
        "1px solid #4dddf8",
    }}
  >
    Normal
  </button>

  <button
    onClick={() =>
      setViewMode("cutaway")
    }
    style={{
      background:
        viewMode === "cutaway"
          ? "#1d6f86"
          : "#102334",
      color: "white",
      padding: "8px 12px",
      borderRadius: "8px",
      border:
        "1px solid #4dddf8",
    }}
  >
    Cutaway
  </button>
</div>

      {hoveredPart && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: 65,
      transform: "translateX(-50%)",
      padding: "8px 12px",
      borderRadius: "8px",
      background: "rgba(5,18,30,0.92)",
      border:
        "1px solid rgba(77,221,248,0.5)",
      color: "#eafaff",
      fontSize: "13px",
      fontWeight: 700,
      pointerEvents: "none",
      zIndex: 100,
    }}
  >
    {hoveredPart}
  </div>

)}


      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <button onClick={() => setAutoRotate((value) => !value)}>
          {autoRotate ? "Stop rotation" : "Auto rotate"}
        </button>

        <button onClick={resetView}>Reset view</button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          color: "#a8bdd5",
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        Drag: Rotate · Scroll: Zoom · Right-drag: Pan
      </div>
    </div>
  );
}

useGLTF.preload("/models/AEROTWIN_Engine.glb");