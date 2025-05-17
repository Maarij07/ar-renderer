import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import styles from '../styles/AR.module.css';

export default function AR() {
    const canvasRef = useRef(null);
    const [arSupported, setArSupported] = useState(false);
    const [arStarted, setArStarted] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        // Check if WebXR is supported
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    setArSupported(supported);
                })
                .catch(error => {
                    console.error('Error checking AR support:', error);
                    setErrorMessage('Error checking AR support: ' + error.message);
                });
        } else {
            setErrorMessage('WebXR not supported in this browser');
        }
    }, []);

    const startAR = async () => {
        if (!arSupported) return;

        try {
            // Set arStarted to true first to render the canvas
            setArStarted(true);

            // Add a small delay to ensure the canvas is rendered
            await new Promise(resolve => setTimeout(resolve, 500));

            // Import Three.js and related modules dynamically to avoid SSR issues
            const THREE = await import('three');
            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
            const { ARButton } = await import('three/examples/jsm/webxr/ARButton');

            // Set up Three.js scene
            const canvas = canvasRef.current;
            if (!canvas) {
                throw new Error("Canvas element not found");
            }

            const scene = new THREE.Scene();

            // Set up camera
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

            // Set up renderer
            const renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.xr.enabled = true;

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, 10, 0);
            scene.add(directionalLight);

            // Create AR button and append to document
            const arButton = ARButton.createButton(renderer, {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            });

            document.body.appendChild(arButton);

            // Variables for AR placement
            let reticle = new THREE.Mesh(
                new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            reticle.matrixAutoUpdate = false;
            reticle.visible = false;
            scene.add(reticle);

            let model = null;
            let modelPlaced = false;

            // Load the GLTF model
            const loader = new GLTFLoader();
            const modelPath = '/models/result.gltf';
            console.log('Attempting to load model from:', modelPath);
            loader.load(modelPath,
                // Success callback
                (gltf) => {
                    console.log("Model loaded successfully", gltf);
                    model = gltf.scene;

                    // Center the model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);

                    // Adjust scale based on model size
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 1.0 / maxDim;
                    model.scale.set(scale, scale, scale);

                    model.visible = false;
                    scene.add(model);
                },
                // Progress callback
                (xhr) => {
                    const percent = xhr.loaded / xhr.total * 100;
                    console.log(`${percent.toFixed(2)}% loaded`);
                },
                // Error callback
                (error) => {
                    console.error('Error loading model:', error);

                    // Try alternative path as fallback
                    console.log('Trying fallback path...');
                    loader.load('/result.gltf',
                        (gltf) => {
                            console.log("Model loaded from fallback path", gltf);
                            model = gltf.scene;
                            model.scale.set(0.5, 0.5, 0.5);
                            model.visible = false;
                            scene.add(model);
                        },
                        undefined,
                        (fallbackError) => {
                            console.error('Fallback loading also failed:', fallbackError);
                            setErrorMessage(`Error loading 3D model: ${error.message}. Please check console for details.`);
                        }
                    );
                },
                // Progress callback
                (xhr) => {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                // Error callback
                (error) => {
                    console.error('Error loading model:', error);
                    setErrorMessage('Error loading 3D model: ' + error.message);
                });

            // Controller for hit testing
            let controller = renderer.xr.getController(0);
            controller.addEventListener('select', onSelect);
            scene.add(controller);

            // Function to handle tap/select events
            function onSelect() {
                if (reticle.visible && model && !modelPlaced) {
                    // Place the model at the reticle position
                    model.position.setFromMatrixPosition(reticle.matrix);
                    model.visible = true;
                    modelPlaced = true;
                } else if (modelPlaced) {
                    // Allow repositioning if already placed
                    modelPlaced = false;
                }
            }

            // XR session hit test source
            let hitTestSource = null;
            let hitTestSourceRequested = false;

            // Animation loop
            renderer.setAnimationLoop((timestamp, frame) => {
                if (frame) {
                    // Perform hit test
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

            // Handle window resize
            const handleResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };

            window.addEventListener('resize', handleResize);

            setArStarted(true);

            // Cleanup function
            return () => {
                window.removeEventListener('resize', handleResize);
                if (renderer) {
                    renderer.setAnimationLoop(null);
                }
                if (document.body.contains(arButton)) {
                    document.body.removeChild(arButton);
                }
            };
        } catch (error) {
            console.error('Error starting AR:', error);
            setErrorMessage('Error starting AR: ' + error.message);
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
                        {errorMessage ? (
                            <p className={styles.errorMessage}>{errorMessage}</p>
                        ) : (
                            <div className={styles.instructions}>
                                Tap on a surface to place the model
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}