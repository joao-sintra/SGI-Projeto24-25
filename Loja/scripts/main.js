import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SGI_Example from "./example_scene.min.js";
//rotaton indicators
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Variables for the model
let suporte;
let lampada_cilindrica;
let lampada_esferica;
let clip, action;
const cor_default = new THREE.Color("lightblue");

let selectedObject = null;
let isRotating = false;
let previousMousePosition = new THREE.Vector2();
let rotationAxis = 'y';
let minRotation = -80;
let maxRotation = 80;

let axesHelper = null;
let rotationIndicator = null;
let composer, outlinePass;


// Scene setup
var container = document.getElementById('model-container');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// Add controls
var controls = new OrbitControls(camera, renderer.domElement);
controls.panSpeed = 0.1;
camera.position.set(-3, 2, 8);
camera.lookAt(0, -1, 3.5);
controls.target.set(0, -1, 2.5);
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0xBDB76B, 0.5);
scene.add(hemiLight);

let mixer = new THREE.AnimationMixer(scene);
const loader = new GLTFLoader();

composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 3;
outlinePass.edgeGlow = 0;
outlinePass.edgeThickness = 1;
outlinePass.visibleEdgeColor.set('#00ff00'); // Green outline
outlinePass.hiddenEdgeColor.set('#190a05');
composer.addPass(outlinePass);

const effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
composer.addPass(effectFXAA);

// Animation Mixer
mixer = new THREE.AnimationMixer(scene);



// Load the model
loader.load(
    'models/ApliqueArticuladoPecaUnica.gltf',
    (gltf) => {
        gltf.scene.traverse((child) => {
            // Assign userData to identify joints and their rotation constraints
            switch (child.name) {
                case 'SupportJoint':
                    child.userData = { axis: 'y', minRotation: -80, maxRotation: 80 };
                    break;
                case 'LongArm':
                case 'ShortArm':
                case 'ArmToAbajurJoint':
                    child.userData = { axis: 'x', minRotation: -90, maxRotation: 90 };
                    break;
                case 'AbajurJoint':
                    child.userData = { axis: 'z', minRotation: -150, maxRotation: 150 };
                    break;
                default:
                    break;
            }
        });
        suporte = gltf.scene.getObjectByName("Suport");
        gltf.scene.position.set(0, 3, -2.5);
        scene.add(gltf.scene);



        function onPointerDown(event) {
            // Calculate pointer position
            const rect = renderer.domElement.getBoundingClientRect();
            const pointer = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            // Raycast to detect the clicked object
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(pointer, camera);

            const intersects = raycaster.intersectObjects(gltf.scene.children, true);

            if (intersects.length > 0) {
                const object = intersects[0].object;

                // Check if the object is a joint with rotation constraints
                if (object.userData && object.userData.axis) {

                    selectedObject = object;
                    isRotating = true;
                    rotationAxis = object.userData.axis;
                    minRotation = object.userData.minRotation;
                    maxRotation = object.userData.maxRotation;
                    previousMousePosition.set(event.clientX, event.clientY);
                    controls.enabled = false;
                    // console.log("Selected object: ", object, "Rotation axis: ", rotationAxis, "Min rotation: ", minRotation, "Max rotation: ", maxRotation);
                    // Highlight the selected object


                    // Add object to OutlinePass
                    outlinePass.selectedObjects = [object];

                    // Add AxesHelper
                    axesHelper = new THREE.AxesHelper(2);
                    object.add(axesHelper);

                    // Add Rotation Indicator
                    //rotationIndicator = createRotationIndicator(object.userData.axis, 1.5);
                    //object.add(rotationIndicator);

                    // Add Rotation Indicator
                    rotationIndicator = createRotationIndicator(object.userData.axis, 1.5);
                    rotationIndicator.name = 'rotationIndicator';
                    object.add(rotationIndicator);




                    //console.log(`Selected object: ${object.name}, Axis: ${rotationAxis}, Min: ${minRotation}, Max: ${maxRotation}`);
                }
            }
        }

        function onPointerMove(event) {

            if (isRotating && selectedObject) {
                console.log("Pointer move");
                const deltaX = event.clientX - previousMousePosition.x;
                const deltaY = event.clientY - previousMousePosition.y;

                previousMousePosition.set(event.clientX, event.clientY);

                // Determine rotation amount (adjust sensitivity as needed)
                const rotationSpeed = 0.015;
                let deltaRotation = deltaX * rotationSpeed;

                // Apply rotation based on axis
                const axis = rotationAxis;
                selectedObject.rotation[axis] += deltaRotation;

                // Normalize rotation angle to the range [-π, π]

                // Convert min and max rotation to radians
                //console.log("Selected object: ", selectedObject, "Rotation axis: ", rotationAxis, "Min rotation: ", minRotation, "Max rotation: ", maxRotation);
                const minAngle = THREE.MathUtils.degToRad(minRotation);
                const maxAngle = THREE.MathUtils.degToRad(maxRotation);

                // Clamp rotation
                selectedObject.rotation[axis] = THREE.MathUtils.clamp(selectedObject.rotation[axis], minAngle, maxAngle);

                // Reset other axes rotations
                if (axis !== 'x') selectedObject.rotation.x = 0;
                if (axis !== 'y') selectedObject.rotation.y = 0;
                if (axis !== 'z') selectedObject.rotation.z = 0;
                //console.log(`Rotating ${axis}-axis: ${THREE.MathUtils.radToDeg(selectedObject.rotation[axis]).toFixed(2)}°`);

            }
        }

        function onPointerUp() {
            if (isRotating && selectedObject) {
                // Remove visual cues


                // Remove from OutlinePass
                outlinePass.selectedObjects = [];

                // Remove AxesHelper
                if (axesHelper) {
                    selectedObject.remove(axesHelper);
                    axesHelper = null;
                }

                // Remove Rotation Indicator
                if (rotationIndicator) {
                    selectedObject.remove(rotationIndicator);
                    rotationIndicator = null;
                }

                isRotating = false;
                selectedObject = null;
                controls.enabled = true; // Re-enable OrbitControls

                console.log("Rotation ended");
            }
        }

        // Add event listeners for mouse interactions
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);

        lampada_cilindrica = scene.getObjectByName("C_LightBulb");
        lampada_esferica = scene.getObjectByName("S_LightBulb");
        lampada_esferica.visible = false;

        lampada_cilindrica.children[0].material.emissive = cor_default;
        SGI_Example.setupMockupScene(scene, suporte);

    },
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%');
    },
    (error) => {
        console.error('An error happened', error);
    }
);
// Helper Functions

function createRotationIndicator(axis, radius) {
    let geometry = new THREE.RingGeometry(radius, radius + 0.05, 32);
    //geometry.name = "rotationIndicator";

    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Yellow color
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });

    const ring = new THREE.Mesh(geometry, material);

    // Rotate the ring to align with the axis
    switch (axis) {
        case 'x':
            ring.rotation.y = Math.PI / 2;
            break;
        case 'y':
            ring.rotation.x = Math.PI / 2;
            break;
        case 'z':
            // Default orientation for Z-axis
            break;
    }
    ring.name = "rotationIndicatorRing";

    return ring;
}

// Animation loop without transformControl.update()
let clock = new THREE.Clock();

function animar() {
    requestAnimationFrame(animar);
    controls.update();
    renderer.render(scene, camera);
    mixer.update(clock.getDelta());
}
animar();

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});