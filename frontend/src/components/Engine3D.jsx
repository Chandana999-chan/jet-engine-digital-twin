import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";

import {
  OrbitControls,
  useGLTF,
  Center,
  Html,
} from "@react-three/drei";

import * as THREE from "three";


/* =========================================================
   HELPERS
========================================================= */

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


function getSensorIntensity(sensorValues) {
  if (!sensorValues) return 0;

  const values = Object.values(sensorValues)
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return 0;

  // This is a normalized visual intensity, not a physical
  // interpretation of individual C-MAPSS sensors.
  const average =
    values.reduce((sum, value) => sum + Math.abs(value), 0) /
    values.length;

  return THREE.MathUtils.clamp(
    average / 100,
    0,
    1
  );
}


/* =========================================================
   ENGINE MODEL
========================================================= */

function EngineModel({
  onLoaded,
  onHover,
  viewMode,
  engineState,
  isPlaying,
  autoRotate,
  scenario,
  sensorSeverity,
  sensorIntensity,
}) {
  const { scene } = useGLTF(
    "/models/AEROTWIN_Engine.glb"
  );

  const modelRef = useRef();

  const model = useMemo(
    () => scene.clone(true),
    [scene]
  );

  const animationTime = useRef(0);

  const status = (
    engineState?.overall_status || "HEALTHY"
  ).toUpperCase();

  const severity = (
    sensorSeverity ||
    scenario?.severity ||
    engineState?.sensor_anomaly_severity ||
    status
  ).toUpperCase();

  const shutdown =
    Boolean(engineState?.shutdown) ||
    Boolean(scenario?.shutdown);

  const critical =
    status === "CRITICAL" ||
    severity === "CRITICAL" ||
    severity === "ANOMALOUS";

  const warning =
    status === "WARNING" ||
    severity === "WARNING";


  useEffect(() => {
    const full = model.getObjectByName(
      "Outer_Nacelle_Full"
    );

    const cutaway = model.getObjectByName(
      "Outer_Nacelle_Cutaway_Final"
    );

    const vibrationRing = model.getObjectByName(
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

    if (cutaway) {
      cutaway.traverse((child) => {
        if (child.isMesh) {
          child.raycast =
            viewMode === "cutaway"
              ? () => {}
              : THREE.Mesh.prototype.raycast;
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

    const box = new THREE.Box3().setFromObject(
      modelRef.current
    );

    const size = box.getSize(
      new THREE.Vector3()
    );

    onLoaded?.(size);
  }, [model, onLoaded]);


  useFrame((_, delta) => {
    if (!modelRef.current) return;

    animationTime.current += delta;

    const vibrationActive =
      !shutdown &&
      (
        warning ||
        critical ||
        sensorIntensity > 0.55 ||
        Boolean(scenario?.name)
      );

    if (!shutdown && (isPlaying || autoRotate)) {
      let rotationSpeed = 0.35;

      if (status === "MODERATE") {
        rotationSpeed = 0.55;
      }

      if (warning) {
        rotationSpeed = 0.85;
      }

      if (critical) {
        rotationSpeed = 1.1;
      }

      if (
        scenario?.name ===
        "Multi-sensor what-if scenario"
      ) {
        rotationSpeed = 1.0;
      }

      modelRef.current.rotation.y +=
        delta * rotationSpeed;
    }


    if (vibrationActive) {
      const baseAmplitude = critical
        ? 0.035
        : warning
          ? 0.018
          : 0.009;

      const amplitude =
        baseAmplitude +
        sensorIntensity * 0.012;

      const frequency = critical
        ? 42
        : warning
          ? 30
          : 23;

      modelRef.current.position.x =
        Math.sin(animationTime.current * frequency) *
        amplitude;

      modelRef.current.position.z =
        Math.cos(animationTime.current * frequency) *
        amplitude;
    } else {
      modelRef.current.position.x =
        THREE.MathUtils.damp(
          modelRef.current.position.x,
          0,
          8,
          delta
        );

      modelRef.current.position.z =
        THREE.MathUtils.damp(
          modelRef.current.position.z,
          0,
          8,
          delta
        );
    }
  });


  return (
    <Center>
      <group ref={modelRef}>
        <primitive
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
          onPointerOut={() => onHover?.(null)}
        />
      </group>
    </Center>
  );
}


/* =========================================================
   HEAT GLOW
========================================================= */

function HeatGlow({
  severity,
  sensorIntensity,
}) {
  const lightRef = useRef();

  const active =
    severity === "WARNING" ||
    severity === "CRITICAL" ||
    severity === "ANOMALOUS";

  useFrame(({ clock }) => {
    if (!lightRef.current) return;

    if (!active) {
      lightRef.current.intensity = 0;
      return;
    }

    const critical =
      severity === "CRITICAL" ||
      severity === "ANOMALOUS";

    const pulse = Math.sin(
      clock.elapsedTime * (critical ? 8 : 4)
    );

    const baseIntensity = critical ? 3.5 : 1.8;

    lightRef.current.intensity =
      baseIntensity +
      pulse * 0.6 +
      sensorIntensity * 1.2;
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0.6, 0]}
      color={
        severity === "CRITICAL" ||
        severity === "ANOMALOUS"
          ? "#ff321c"
          : "#ff9e45"
      }
      intensity={0}
      distance={7}
      decay={2}
    />
  );
}


/* =========================================================
   SMOKE PARTICLES
========================================================= */

function SmokeParticles({
  active,
  severity,
}) {
  const particleRefs = useRef([]);

  const particles = useMemo(() => {
    return Array.from({ length: 65 }, () => ({
      x: (Math.random() - 0.5) * 0.65,
      y: Math.random() * 1.8,
      z: (Math.random() - 0.5) * 0.55,
      speed: 0.35 + Math.random() * 0.85,
      size: 0.045 + Math.random() * 0.07,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);


  useFrame(({ clock }) => {
    const time = clock.elapsedTime;

    particleRefs.current.forEach((mesh, index) => {
      if (!mesh) return;

      if (!active) {
        mesh.visible = false;
        return;
      }

      const particle = particles[index];

      const progress =
        (time * particle.speed +
          particle.offset) %
        2.5;

      mesh.visible = true;

      mesh.position.set(
        particle.x +
          Math.sin(time * 1.5 + particle.offset) * 0.08,

        particle.y + progress,

        particle.z
      );

      const scale =
        particle.size *
        (1 + progress * 0.55);

      mesh.scale.setScalar(scale);

      mesh.material.opacity =
        Math.max(0, 0.65 - progress * 0.22);
    });
  });


  const smokeColor =
    severity === "CRITICAL" ||
    severity === "ANOMALOUS"
      ? "#55565b"
      : "#aeb7c0";


  return (
    // Position is approximate relative to the GLB origin.
    // Adjust after checking the exhaust location in your model.
    <group position={[0.35, 0.3, 0]}>
      {particles.map((particle, index) => (
        <mesh
          key={index}
          ref={(element) => {
            particleRefs.current[index] = element;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />

          <meshBasicMaterial
            color={smokeColor}
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}


/* =========================================================
   BLAST EFFECT
========================================================= */

function BlastEffect({
  active,
  triggerKey,
  onComplete,
}) {
  const ringRef = useRef();
  const lightRef = useRef();
  const startTime = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (active) {
      startTime.current = null;
      completedRef.current = false;
    }
  }, [active, triggerKey]);


  useFrame(({ clock }) => {
    if (!ringRef.current || !lightRef.current) return;

    if (!active) {
      ringRef.current.visible = false;
      lightRef.current.intensity = 0;
      return;
    }

    if (startTime.current === null) {
      startTime.current = clock.elapsedTime;
      completedRef.current = false;
    }

    const elapsed =
      clock.elapsedTime - startTime.current;

    const duration = 2.5;

    const progress = Math.min(
      elapsed / duration,
      1
    );

    ringRef.current.visible = progress < 1;

    ringRef.current.scale.setScalar(
      0.5 + progress * 4
    );

    ringRef.current.material.opacity =
      Math.max(0, 0.85 * (1 - progress));

    lightRef.current.intensity =
      Math.max(0, 8 * (1 - progress));

    if (
      progress >= 1 &&
      !completedRef.current
    ) {
      completedRef.current = true;
      onComplete?.();
    }
  });


  return (
    <group position={[0, 0, 0]}>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.45, 0.08, 12, 48]} />

        <meshBasicMaterial
          color="#ff6b1c"
          transparent
          opacity={0}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        color="#ff5a19"
        intensity={0}
        distance={12}
      />
    </group>
  );
}


/* =========================================================
   CAMERA
========================================================= */

function CameraSetup({
  modelSize,
  controlsRef,
  resetKey,
}) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (!modelSize) return;

    const maxDimension = Math.max(
      modelSize.x,
      modelSize.y,
      modelSize.z
    );

    const distance = Math.max(
      maxDimension * 2.2,
      3
    );

    camera.position.set(
      distance * 0.8,
      distance * 0.45,
      distance * 1.2
    );

    camera.near = Math.max(
      maxDimension / 10000,
      0.001
    );

    camera.far = Math.max(
      maxDimension * 100,
      1000
    );

    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);

      controlsRef.current.minDistance =
        Math.max(maxDimension * 0.01, 0.02);

      controlsRef.current.maxDistance =
        Math.max(maxDimension * 10, 20);

      controlsRef.current.update();
    }

    invalidate();
  }, [
    modelSize,
    camera,
    controlsRef,
    resetKey,
    invalidate,
  ]);

  return null;
}


/* =========================================================
   LOADER
========================================================= */

function Loader() {
  return (
    <Html center>
      <div
        style={{
          color: "#dce7f5",
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        Loading 3D engine...
      </div>
    </Html>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function JetEngineModel({
  engineState = null,
  isPlaying = false,
  scenario = null,
  simulationMode = false,
  sensorValues = null,
  sensorSeverity = null,
  blastTrigger = 0,
  onBlastComplete,
}) {
  const controlsRef = useRef();

  const [modelSize, setModelSize] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredPart, setHoveredPart] = useState(null);
  const [viewMode, setViewMode] = useState("cutaway");

  const [manualSmoke, setManualSmoke] = useState(false);
  const [manualBlast, setManualBlast] = useState(false);
  const [internalBlastTrigger, setInternalBlastTrigger] = useState(0);

  const blastTimerRef = useRef(null);


  useEffect(() => {
    return () => {
      if (blastTimerRef.current) {
        window.clearTimeout(blastTimerRef.current);
      }
    };
  }, []);


  const resetView = () => {
    setResetKey((value) => value + 1);
  };


  const status = (
    engineState?.overall_status || "HEALTHY"
  ).toUpperCase();

  const shutdown =
    Boolean(engineState?.shutdown) ||
    Boolean(scenario?.shutdown);


  const severity = (
    sensorSeverity ||
    scenario?.severity ||
    engineState?.sensor_anomaly_severity ||
    status
  ).toUpperCase();


  const sensorIntensity = useMemo(
    () => getSensorIntensity(sensorValues),
    [sensorValues]
  );


  const statusColor = {
    HEALTHY: "#31d6a0",
    MODERATE: "#e9bd58",
    WARNING: "#ff9e45",
    CRITICAL: "#ff5252",
    NORMAL: "#31d6a0",
    ANOMALOUS: "#ff5252",
  }[severity] || "#31d6a0";


  const smokeActive =
    simulationMode &&
    !shutdown &&
    (
      manualSmoke ||
      severity === "WARNING" ||
      severity === "CRITICAL" ||
      severity === "ANOMALOUS"
    );


  const triggerBlast = () => {
    if (blastTimerRef.current) {
      window.clearTimeout(blastTimerRef.current);
    }

    setManualBlast(false);

    // Changing this value restarts the blast animation.
    setInternalBlastTrigger((value) => value + 1);

    requestAnimationFrame(() => {
      setManualBlast(true);
    });

    blastTimerRef.current = window.setTimeout(() => {
      setManualBlast(false);
    }, 2800);
  };


  const blastActive =
    manualBlast ||
    Boolean(scenario?.visualBlast);


  const currentBlastTrigger =
    internalBlastTrigger + Number(blastTrigger || 0);


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
        camera={{
          position: [4, 3, 6],
          fov: 45,
        }}
        gl={{
          antialias: true,
        }}
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


        {simulationMode && (
          <>
            <HeatGlow
              severity={severity}
              sensorIntensity={sensorIntensity}
            />

            <SmokeParticles
              active={smokeActive}
              severity={severity}
            />

            <BlastEffect
              active={blastActive}
              triggerKey={currentBlastTrigger}
              onComplete={onBlastComplete}
            />
          </>
        )}


        <Suspense fallback={<Loader />}>
          <EngineModel
            onLoaded={setModelSize}
            onHover={setHoveredPart}
            viewMode={viewMode}
            engineState={engineState}
            isPlaying={isPlaying}
            autoRotate={autoRotate}
            scenario={scenario}
            sensorSeverity={sensorSeverity}
            sensorIntensity={sensorIntensity}
          />
        </Suspense>


        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableRotate
          enableZoom
          enablePan
          autoRotate={false}
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


      {/* Normal / Cutaway */}
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
        {["normal", "cutaway"].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              background:
                viewMode === mode
                  ? "#1d6f86"
                  : "#102334",
              color: "white",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #4dddf8",
              cursor: "pointer",
            }}
          >
            {mode === "normal" ? "Normal" : "Cutaway"}
          </button>
        ))}
      </div>


      {/* Simulation status */}
      {simulationMode && (
        <div
          style={{
            position: "absolute",
            top: 58,
            left: 12,
            padding: "7px 11px",
            borderRadius: 8,
            background: "rgba(5,18,30,0.9)",
            border: `1px solid ${statusColor}`,
            color: statusColor,
            fontSize: 12,
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          {shutdown
            ? "ENGINE SHUTDOWN"
            : isPlaying
              ? "SIMULATION RUNNING"
              : "SIMULATION PAUSED"}
        </div>
      )}


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
            border: "1px solid rgba(77,221,248,0.5)",
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


      {/* Rotation / reset */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          gap: 8,
          zIndex: 20,
        }}
      >
        <button
          onClick={() =>
            setAutoRotate((value) => !value)
          }
          style={{
            background: "#102334",
            color: "white",
            border: "1px solid #4dddf8",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {autoRotate ? "Stop rotation" : "Auto rotate"}
        </button>

        <button
          onClick={resetView}
          style={{
            background: "#102334",
            color: "white",
            border: "1px solid #4dddf8",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Reset view
        </button>
      </div>


      {/* Visual effects controls */}
      {simulationMode && (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 42,
            display: "flex",
            gap: 7,
            zIndex: 20,
          }}
        >
          <button
            onClick={() =>
              setManualSmoke((value) => !value)
            }
            style={{
              background: manualSmoke
                ? "#8a5a24"
                : "#102334",
              color: "white",
              border: "1px solid #ffb45f",
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {manualSmoke ? "Stop smoke" : "Smoke"}
          </button>

          <button
            onClick={triggerBlast}
            style={{
              background: "#7c321f",
              color: "white",
              border: "1px solid #ff7645",
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Trigger blast
          </button>
        </div>
      )}


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