import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import styles from '../styles/AR.module.css';

export default function AR() {
    const canvasRef = useRef(null);
    const [arSupported, setArSupported] = useState(false);
    const [arStarted, setArStarted] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [performanceMode, setPerformanceMode] = useState('auto'); // 'low', 'medium', 'high', 'auto'
    const [isLowEndDevice, setIsLowEndDevice] = useState(false);

    // Check device performance on component mount
    useEffect(() => {
        checkDevicePerformance();
        checkARSupport();
    }, []);

    // Function to check device performance
    const checkDevicePerformance = () => {
        // Simple heuristic to detect low-end devices
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            setIsLowEndDevice(true);
            setPerformanceMode('low');
            return;
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';

        // Check for known low-end GPU identifiers
        const lowEndGPUs = ['PowerVR', 'Mali-4', 'Mali-T6', 'Mali-G5', 'Adreno 3', 'Adreno 4'];
        const isLowEnd = lowEndGPUs.some(gpu => renderer.includes(gpu));

        // Also check device memory if available
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

        setIsLowEndDevice(isLowEnd || lowMemory);
        setPerformanceMode(isLowEnd || lowMemory ? 'low' : 'medium');

        console.log('Device performance check:', {
            renderer,
            memory: navigator.deviceMemory || 'unknown',
            performanceMode: isLowEnd || lowMemory ? 'low' : 'medium'
        });
    };

    // Function to check AR support
    const checkARSupport = () => {
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    setArSupported(supported);
                    if (!supported) {
                        // Try simpler session type as fallback
                        return navigator.xr.isSessionSupported('inline')
                            .then(inlineSupported => {
                                if (inlineSupported) {
                                    setArSupported(true);
                                    setErrorMessage('Full AR not supported. Using simplified mode.');
                                }
                            });
                    }
                })
                .catch(error => {
                    console.error('Error checking AR support:', error);
                    setErrorMessage('Error checking AR support: ' + error.message);
                });
        } else {
            setErrorMessage('WebXR not supported in this browser');
        }
    };

    const startAR = async () => {
        if (!arSupported) return;

        try {
            setIsLoading(true);
            setArStarted(true);

            // Add a small delay to ensure the canvas is rendered
            await new Promise(resolve => setTimeout(resolve, 300));

            // Import Three.js and related modules dynamically to avoid SSR issues
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
            const { ARButton } = await import('three/examples/jsm/webxr/ARButton');
            // Import the DRACOLoader for compressed models
            const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader');

            // Set up Three.js scene
            const canvas = canvasRef.current;
            if (!canvas) {
                throw new Error("Canvas element not found");
            }

            const scene = new THREE.Scene();

            // Set up camera
            const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

            // Set up renderer with optimized settings
            const renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: performanceMode !== 'low', // Disable antialiasing for low-end devices
                powerPreference: performanceMode === 'low' ? 'low-power' : 'high-performance',
                precision: performanceMode === 'low' ? 'lowp' : 'mediump',
                preserveDrawingBuffer: false
            });

            // Set pixel ratio based on performance mode
            const pixelRatio = window.devicePixelRatio || 1;
            renderer.setPixelRatio(performanceMode === 'low' ? Math.min(pixelRatio, 1) :
                performanceMode === 'medium' ? Math.min(pixelRatio, 1.5) :
                    pixelRatio);

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.xr.enabled = true;

            // Simplified lighting setup for better performance
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            scene.add(ambientLight);

            // Only add directional light on medium/high performance devices
            if (performanceMode !== 'low') {
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(0, 5, 0);
                scene.add(directionalLight);
            }

            // Create AR button and append to document
            const arButton = ARButton.createButton(renderer, {
                requiredFeatures: performanceMode === 'low' ? [] : ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            });

            document.body.appendChild(arButton);

            // Simplified reticle geometry for better performance
            let reticle = new THREE.Mesh(
                new THREE.RingGeometry(0.15, 0.2, performanceMode === 'low' ? 16 : 32).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            reticle.matrixAutoUpdate = false;
            reticle.visible = false;
            scene.add(reticle);

            let model = null;
            let modelPlaced = false;

            // Configure DRACO loader for compressed models
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('/draco/');

            // Load the GLTF model with compression support
            const loader = new GLTFLoader();
            loader.setDRACOLoader(dracoLoader);

            // Choose model based on device capability
            const modelPath = isLowEndDevice ?
                '/models/result_low.gltf' :  // Use a lower poly model for low-end devices
                '/models/result.gltf';       // Use the original model for better devices

            // Fallback paths to try if main model fails
            const fallbackPaths = [
                '/models/result.gltf',
                '/result.gltf',
                '/models/fallback.gltf'
            ];

            console.log('Attempting to load model from:', modelPath);

            const loadModel = (path, index = 0) => {
                loader.load(
                    path,
                    // Success callback
                    (gltf) => {
                        console.log("Model loaded successfully", gltf);
                        model = gltf.scene;

                        // Optimize the model based on device performance
                        optimizeModel(model, THREE);

                        model.visible = false;
                        scene.add(model);
                        setIsLoading(false);
                    },
                    // Progress callback
                    (xhr) => {
                        const percent = xhr.loaded / xhr.total * 100;
                        setLoadingProgress(Math.floor(percent));
                        console.log(`${percent.toFixed(2)}% loaded`);
                    },
                    // Error callback
                    (error) => {
                        console.error(`Error loading model from ${path}:`, error);

                        // Try next fallback if available
                        if (index < fallbackPaths.length) {
                            console.log(`Trying fallback path: ${fallbackPaths[index]}`);
                            loadModel(fallbackPaths[index], index + 1);
                        } else {
                            // All paths failed, show error
                            console.error('All model loading attempts failed');
                            setErrorMessage('Could not load 3D model. Please try again later.');
                            setIsLoading(false);
                        }
                    }
                );
            };

            // Function to optimize model based on device capability
            const optimizeModel = (model, THREE) => {
                // Center the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);

                // Scale based on performance mode
                const scale = performanceMode === 'low' ? 0.25 : 0.3;
                model.scale.set(scale, scale, scale);

                // Rotate the model
                model.rotation.x = THREE.MathUtils.degToRad(-90);

                // Optimize materials and geometries
                model.traverse((node) => {
                    if (node.isMesh) {
                        // For low-end devices, simplify materials
                        if (performanceMode === 'low') {
                            // Replace with basic material for better performance
                            const color = node.material.color ?
                                node.material.color.clone() :
                                new THREE.Color(0xcccccc);

                            node.material = new THREE.MeshBasicMaterial({
                                color: color,
                                map: node.material.map
                            });
                        } else {
                            // For better devices, just ensure proper material settings
                            if (node.material) {
                                node.material.needsUpdate = true;

                                if (node.material.map) {
                                    node.material.map.encoding = THREE.sRGBEncoding;
                                }
                            }
                        }

                        // Simplify geometry on low-end devices if it has too many vertices
                        if (performanceMode === 'low' && node.geometry &&
                            node.geometry.attributes &&
                            node.geometry.attributes.position &&
                            node.geometry.attributes.position.count > 5000) {
                            console.log('Simplifying complex geometry',
                                node.geometry.attributes.position.count, 'vertices');
                            // We don't actually simplify here as it would require importing
                            // a geometry simplification library, but in a real app you would
                            // use a library like SimplifyModifier or pregenerate LODs
                        }
                    }
                });
            };

            // Start model loading
            loadModel(modelPath);

            // Controller for hit testing
            let controller = renderer.xr.getController(0);
            controller.addEventListener('select', onSelect);
            scene.add(controller);

            // Function to handle tap/select events
            function onSelect() {
                if (model && (!reticle.visible || performanceMode === 'low')) {
                    // For low-end devices, just place in front of camera
                    if (performanceMode === 'low' && !modelPlaced) {
                        // Place model 1 meter in front of camera
                        const position = new THREE.Vector3(0, 0, -1).applyMatrix4(controller.matrixWorld);
                        model.position.copy(position);
                        model.visible = true;
                        modelPlaced = true;
                    }
                    // For better devices, place at reticle
                    else if (reticle.visible && !modelPlaced) {
                        model.position.setFromMatrixPosition(reticle.matrix);
                        model.visible = true;
                        modelPlaced = true;
                    }
                    // Allow repositioning
                    else if (modelPlaced) {
                        modelPlaced = false;
                        if (performanceMode !== 'low') {
                            model.visible = false;
                        }
                    }
                }
            }

            // XR session hit test source (only for medium/high performance)
            let hitTestSource = null;
            let hitTestSourceRequested = false;

            // Simple FPS counter for performance monitoring
            let frameCount = 0;
            let lastTime = performance.now();
            let fps = 0;

            const updatePerformanceMode = (currentFps) => {
                // If FPS is too low, reduce quality settings
                if (currentFps < 20 && performanceMode !== 'low') {
                    console.log('FPS too low, reducing quality settings', currentFps);
                    setPerformanceMode('low');

                    // Simplify lighting
                    scene.children.forEach(child => {
                        if (child.isDirectionalLight) {
                            scene.remove(child);
                        }
                    });

                    // Lower renderer quality
                    renderer.setPixelRatio(1);
                    renderer.antialias = false;

                    // Optimize model if already loaded
                    if (model) {
                        optimizeModel(model, THREE);
                    }
                }
            };

            // Animation loop
            renderer.setAnimationLoop((timestamp, frame) => {
                // Update FPS counter
                frameCount++;
                const now = performance.now();
                if (now - lastTime >= 1000) {
                    fps = frameCount;
                    frameCount = 0;
                    lastTime = now;
                    console.log('FPS:', fps);

                    // Adjust performance mode based on FPS
                    updatePerformanceMode(fps);
                }

                if (frame && performanceMode !== 'low') {
                    // Perform hit test for medium/high performance devices
                    if (!hitTestSourceRequested) {
                        const session = renderer.xr.getSession();

                        session.requestReferenceSpace('viewer').then((referenceSpace) => {
                            session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                                hitTestSource = source;
                            });
                        });

                        session.addEventListener('end', () => {
                            hitTestSourceRequested = false;
                            hitTestSource = null;

                            // Clean up AR button when session ends
                            if (document.body.contains(arButton)) {
                                document.body.removeChild(arButton);
                            }

                            setArStarted(false);
                        });

                        hitTestSourceRequested = true;
                    }

                    if (hitTestSource) {
                        const referenceSpace = renderer.xr.getReferenceSpace();
                        const hitTestResults = frame.getHitTestResults(hitTestSource);

                        if (hitTestResults.length) {
                            const hit = hitTestResults[0];
                            const pose = hit.getPose(referenceSpace);

                            if (pose) {
                                reticle.visible = true;
                                reticle.matrix.fromArray(pose.transform.matrix);
                            }
                        } else {
                            reticle.visible = false;
                        }
                    }
                }

                // Render the scene
                renderer.render(scene, camera);
            });

            // Handle window resize with throttling for better performance
            let resizeTimeout;
            const handleResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                }, 200);
            };

            window.addEventListener('resize', handleResize);

            // Cleanup function
            return () => {
                window.removeEventListener('resize', handleResize);
                if (renderer) {
                    renderer.setAnimationLoop(null);
                }
                if (document.body.contains(arButton)) {
                    document.body.removeChild(arButton);
                }
                dracoLoader.dispose();
            };
        } catch (error) {
            console.error('Error starting AR:', error);
            setErrorMessage('Error starting AR: ' + error.message);
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>AR Experience</title>
                <meta name="description" content="AR Experience with Next.js and Three.js" />
                <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
            </Head>

            <main className={styles.main}>
                {!arStarted ? (
                    <div>
                        <h1>AR Model Viewer</h1>
                        {errorMessage ? (
                            <p className={styles.errorMessage}>{errorMessage}</p>
                        ) : (
                            <>
                                <p>Place your 3D model in augmented reality</p>
                                <div className={styles.performanceSelector}>
                                    <label>
                                        Device Performance:
                                        <select
                                            value={performanceMode}
                                            onChange={(e) => setPerformanceMode(e.target.value)}
                                        >
                                            <option value="auto">Auto-detect</option>
                                            <option value="low">Low-end Device</option>
                                            <option value="medium">Mid-range Device</option>
                                            <option value="high">High-end Device</option>
                                        </select>
                                    </label>
                                </div>
                                <button
                                    className={styles.startButton}
                                    onClick={startAR}
                                    disabled={!arSupported}
                                >
                                    {arSupported ? 'Start AR Experience' : 'AR Not Supported'}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <canvas ref={canvasRef} className={styles.canvas} id="ar-canvas"></canvas>
                        {isLoading ? (
                            <div className={styles.loadingOverlay}>
                                <p>Loading model... {loadingProgress}%</p>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${loadingProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        ) : errorMessage ? (
                            <p className={styles.errorMessage}>{errorMessage}</p>
                        ) : (
                            <div className={styles.instructions}>
                                Tap {performanceMode === 'low' ? '' : 'on a surface '}
                                to place the model
                            </div>
                        )}

                        {arStarted && (
                            <button
                                className={styles.backButton}
                                onClick={() => {
                                    setArStarted(false);
                                    setErrorMessage('');
                                }}
                            >
                                ← Back
                            </button>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
