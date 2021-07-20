import * as THREE from './lib/scripts/three.module.js';

import { OrbitControls } from './lib/scripts/OrbitControls.js';

import { GUI } from './lib/scripts/dat.gui.module.js';

import * as UTILS from './lib/scripts/utils.js';


// user interface and default parameters
var params = { 
    'showProperty': false,
    'currentProperty': "",
    'truePropertyColor': 0x00ff00,
    'falsePropertyColor': 0xff0000,
    'backgroundColor': 0xfffdd0,
    'pointsMaterialColor': 0x00ff00,
    'edgesMaterialColor': 0x0000ff,
    'trianglesMaterialColor': 0xff0000,
    'trianglesOpacity': .2,
    'tetrahedronsMaterialColor': 0xff0000,
    'tetrahedronSize': .3,
    'test': null
};


// setting up the scene
var gui = null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( 0xffffff, 1 );
renderer.clear();
document.body.appendChild( renderer.domElement );
renderer.setClearColor( params['backgroundColor'], 1 );

const controls = new OrbitControls( camera, renderer.domElement );

camera.position.set(30,50,100);
controls.update();

camera.lookAt(0,0,0);
controls.update();






// Global variables:
// - modelData and atomData are the global variables containing the data of the model and atoms respectively.
var modelData = null;
var atomsData = null;
// - atoms contains the names of the atomic propositions involved
var atoms = [];
// - variables containing the graphical data
var pointObject = null;
var pointsCoordinates = null;

var edgeObject = null;
var edgesCoordinates = null;

var triangleMaterial = null;
var triangleObject = null;
var trianglesCoordinates = null;

var tetrahedronObject = null;
var tetrahedronsCoordinates = null;
var tetrahedronsBarycenters = null;
var tetrahedronsResizedCoordinates = null;

var pointEval = null;
var edgeEval = null;
var triangleEval = null;
var tetrahedronEval = null;



// Uploading and using the geometric data from the user
// First the model data
var uploadModelButton = document.getElementById('modelfileid');
var uploadAtomsButton = document.getElementById('atomsfileid');
var submitForm = document.getElementById('submitform');

// Upload model data
uploadModelButton.addEventListener('change', function(){
    var reader = new FileReader();
    reader.onload = function(event) {
        modelData = JSON.parse(event.target.result);
        if(atomsData) {
            submitForm.style.display = 'none';
            setupModel();
            setupUI();
            animate();
        }
    };
    reader.readAsText(uploadModelButton.files[0]);
});

// Upload atom data
uploadAtomsButton.addEventListener('change', function(){
    var reader = new FileReader();
    reader.onload = function(event) {
        atomsData = JSON.parse(event.target.result);
        if(atomsData) {
            submitForm.style.display = 'none';
            setupModel();
            setupUI();
            animate();
        }
    };
    reader.readAsText(uploadAtomsButton.files[0]);
});









// Function to read the file containing the model data
function uploadModelFile () {
    // Retrieve uploaded file
    var modelData;
    var reader = new FileReader();
    reader.onload = function(event) {
        // console.log(JSON.parse(event.target.result));
        modelData = JSON.parse(event.target.result);
    };
    // console.log(document.getElementById('modelfileid').files[0]);
    reader.readAsText(document.getElementById('modelfileid').files[0]);
    // console.log(modelData)
    // return await UTILS.readFileAsync(document.getElementById('modelfileid').files[0]);
    return modelData;
}



// Read the model and atoms data and upload them in the graphic card
function setupModel () {
    // console.log(modelData);

    // Store the coordinates of points in THREE.Vector3 structures
    const coordinatesOfPoints = [];
    modelData["coordinatesOfPoints"].forEach(coord => {
        coordinatesOfPoints.push( new THREE.Vector3( coord[0], coord[1], coord[2] ) );
    });


    // Store the atom names
    atoms = Object.keys(atomsData);
    params["currentProperty"] = atoms[0];




    // store the simplexes in apposite structures
    pointsCoordinates = [];
    edgesCoordinates = [];
    trianglesCoordinates = [];

    tetrahedronsCoordinates = [];
    tetrahedronsBarycenters = [];
    tetrahedronsResizedCoordinates = [];


    pointEval = UTILS.valDict(atoms);
    edgeEval = UTILS.valDict(atoms);
    triangleEval = UTILS.valDict(atoms);
    tetrahedronEval = UTILS.valDict(atoms);


    modelData["simplexes"].forEach( (simplex, i) => {
        var pointsOfSimplex = simplex["points"];
        switch (pointsOfSimplex.length) {
            case 1:
                pointsCoordinates.push( coordinatesOfPoints[pointsOfSimplex[0]] );
                // UTILS.udpateEval(pointEval, simplex["atoms"]);
                UTILS.udpateEvalExt(pointEval, atomsData, i);
                break;

            case 2:
                edgesCoordinates.push( coordinatesOfPoints[pointsOfSimplex[0]]);
                edgesCoordinates.push( coordinatesOfPoints[pointsOfSimplex[1]]);
                // UTILS.udpateEval(edgeEval, simplex["atoms"]);
                UTILS.udpateEvalExt(edgeEval, atomsData, i);
                break;

            case 3:
                trianglesCoordinates.push( coordinatesOfPoints[pointsOfSimplex[0]]);
                trianglesCoordinates.push( coordinatesOfPoints[pointsOfSimplex[1]]);
                trianglesCoordinates.push( coordinatesOfPoints[pointsOfSimplex[2]]);
                // UTILS.udpateEval(triangleEval, simplex["atoms"]);
                UTILS.udpateEvalExt(triangleEval, atomsData, i);
                break;

            case 4:
                // The coordinates of the tetrahedron are stored in tetrahedronCoordinates
                var tetraCoords = [
                    coordinatesOfPoints[pointsOfSimplex[0]],
                    coordinatesOfPoints[pointsOfSimplex[1]],
                    coordinatesOfPoints[pointsOfSimplex[2]],
                    coordinatesOfPoints[pointsOfSimplex[3]]
                ];
                tetraCoords.forEach(c => {
                    tetrahedronsCoordinates.push( c );
                });

                // Compute the coordinates of the barycenter of the tetrahedron
                var barycenter = new THREE.Vector3().add(coordinatesOfPoints[pointsOfSimplex[0]]).add(coordinatesOfPoints[pointsOfSimplex[1]]).add(coordinatesOfPoints[pointsOfSimplex[2]]).add(coordinatesOfPoints[pointsOfSimplex[3]]).divideScalar(4);
                tetrahedronsBarycenters.push( barycenter );

                // Compute the resized coordinates
                UTILS.computeResizedCoordinatesTetrahedron( tetrahedronsResizedCoordinates, tetraCoords, barycenter, params["tetrahedronSize"] );
                // UTILS.udpateEval(tetrahedronEval, simplex["atoms"]);
                UTILS.udpateEvalExt(tetrahedronEval, atomsData, i);
                break;
        
            default:
                break;
        }
    });


    // draw points
    const pointMaterial = new THREE.PointsMaterial( {
        color: 0xffffff,
        vertexColors: THREE.VertexColors
    } );
    const pointBufferGeometry = new THREE.BufferGeometry().setFromPoints( pointsCoordinates );
    UTILS.addColorAttribute(pointBufferGeometry);
    pointObject = new THREE.Points( pointBufferGeometry, pointMaterial );
    UTILS.setColorBase(pointObject, params['pointsMaterialColor']);
    scene.add( pointObject );


    // draw edges
    const edgeMaterial = new THREE.LineBasicMaterial( {
        vertexColors: THREE.VertexColors
    } );
    const edgeBufferGeometry = new THREE.BufferGeometry().setFromPoints( edgesCoordinates );
    UTILS.addColorAttribute(edgeBufferGeometry);
    edgeObject = new THREE.LineSegments( edgeBufferGeometry, edgeMaterial );
    UTILS.setColorBase(edgeObject, params['edgesMaterialColor']);
    scene.add( edgeObject );


    // draw triangles
    triangleMaterial = new THREE.MeshBasicMaterial( {
        vertexColors: THREE.VertexColors,
        opacity: .2,
        transparent: true,
        side: THREE.DoubleSide
    } );
    const triangleBufferGeometry = new THREE.BufferGeometry().setFromPoints( trianglesCoordinates );
    UTILS.addColorAttribute(triangleBufferGeometry);
    triangleObject = new THREE.Mesh( triangleBufferGeometry, triangleMaterial );
    UTILS.setColorBase(triangleObject, params['trianglesMaterialColor']);
    scene.add( triangleObject );


    // draw tetrahedrons
    const tetrahedronMaterial = new THREE.MeshBasicMaterial( {
        vertexColors: THREE.VertexColors
    } );
    const tetrahedronsBufferGeometry = new THREE.BufferGeometry().setFromPoints( tetrahedronsResizedCoordinates );
    UTILS.addColorAttribute(tetrahedronsBufferGeometry);
    tetrahedronObject = new THREE.Mesh( tetrahedronsBufferGeometry, tetrahedronMaterial );
    UTILS.setColorBase(tetrahedronObject, params['tetrahedronsMaterialColor']);
    scene.add( tetrahedronObject );



}





// Handling events for the UI
function showPropertyChanged() {
    // change the colors of the objects in the scene
    if ( params['showProperty'] ) {
        UTILS.setColorEval(pointObject,        pointEval[params['currentProperty']],        1,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(edgeObject,         edgeEval[params['currentProperty']],         2,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(triangleObject,     triangleEval[params['currentProperty']],     3,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(tetrahedronObject,  tetrahedronEval[params['currentProperty']],  12, params['truePropertyColor'], params['falsePropertyColor']);
    } else {
        UTILS.setColorBase(pointObject,        params['pointsMaterialColor']);
        UTILS.setColorBase(edgeObject,         params['edgesMaterialColor']);
        UTILS.setColorBase(triangleObject,     params['trianglesMaterialColor']);
        UTILS.setColorBase(tetrahedronObject,  params['tetrahedronsMaterialColor']);
    }
}

function currentPropertyChanged() {
    // change the current property
    if ( params['showProperty'] ) {
        UTILS.setColorEval(pointObject,        pointEval[params['currentProperty']],        1,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(edgeObject,         edgeEval[params['currentProperty']],         2,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(triangleObject,     triangleEval[params['currentProperty']],     3,  params['truePropertyColor'], params['falsePropertyColor']);
        UTILS.setColorEval(tetrahedronObject,  tetrahedronEval[params['currentProperty']],  12, params['truePropertyColor'], params['falsePropertyColor']);
    }
}

function backgroundColorChanged() {
    // change the background color
    renderer.setClearColor( params['backgroundColor'], 1 );
}

// function pointsMaterialColorChanged() {
//     // change pointsMaterialColor and update the material
//     pointMaterial.color.set( params['pointsMaterialColor'] );
//     pointMaterial.needsUpdate = true;
// }

// function edgesMaterialColorChanged() {
//     // change edgesMaterialColor
//     edgeMaterial.color.set( params['edgesMaterialColor'] );
// }

// function trianglesMaterialColorChanged() {
//     // change trianglesMaterialColor
//     triangleMaterial.color.set( params['trianglesMaterialColor'] );
// }

// function tetrahedronsMaterialColorChanged() {
    // change tetrahedronsMaterialColor
//     tetrahedronMaterial.color.set( params['tetrahedronsMaterialColor'] );
// }

function objectColorChanged(object, color) {
    if ( !params['showProperty'] ) {
        UTILS.setColorBase( object, color );
    }
}

function trianglesOpacityChanged() {
    // change opacity triangles
    triangleMaterial.opacity = params['trianglesOpacity'];
}

function tetrahedronSizeChanged() {
    // change tetrahedra geometry
    UTILS.resizeTetrahedrons( tetrahedronObject.geometry, tetrahedronsCoordinates, tetrahedronsBarycenters, params["tetrahedronSize"]);
    tetrahedronObject.geometry.attributes.position.needsUpdate = true;
}





// Setup the UI
function setupUI () {
    gui = new GUI();
    const folderProperty = gui.addFolder( 'Property' );
    folderProperty.add( params, 'showProperty' ).name( 'Show Property' ).onChange(showPropertyChanged);
    folderProperty.add( params, 'currentProperty', atoms ).name( 'Property' ).onChange(currentPropertyChanged);
    const folderAppearance = gui.addFolder( 'Appearance' );
        const folderSceneAppearance = folderAppearance.addFolder( 'Scene' );
        folderSceneAppearance.addColor( params, 'backgroundColor' ).name('Color').onChange(backgroundColorChanged);
        const folderPointAppearance = folderAppearance.addFolder( 'Points' );
        folderPointAppearance.addColor( params, 'pointsMaterialColor' ).name('Color').onFinishChange( () => objectColorChanged(pointObject, params['pointsMaterialColor']));
        const folderEdgeAppearance = folderAppearance.addFolder( 'Edges' );
        folderEdgeAppearance.addColor( params, 'edgesMaterialColor' ).name('Color').onFinishChange( () => objectColorChanged(edgeObject, params['edgesMaterialColor']));
        const folderTriangleAppearance = folderAppearance.addFolder( 'Triangles' );
        folderTriangleAppearance.addColor( params, 'trianglesMaterialColor' ).name('Color').onFinishChange( () => objectColorChanged(triangleObject, params['trianglesMaterialColor']));
        folderTriangleAppearance.add( params, 'trianglesOpacity', 0, 1 ).name( 'Opacity' ).onChange(trianglesOpacityChanged);
        const folderTetrahedronAppearance = folderAppearance.addFolder( 'Tetrahedrons' );
        folderTetrahedronAppearance.addColor( params, 'tetrahedronsMaterialColor' ).name('Color').onFinishChange( () => objectColorChanged(tetrahedronObject, params['tetrahedronsMaterialColor']));
        folderTetrahedronAppearance.add( params, 'tetrahedronSize', 0, 1 ).name( 'Size' ).onChange(tetrahedronSizeChanged);
}

// gui.add( params, 'test', { a: 'A', b: 'B', c: 'C' } ).name('Something').onChange( function (){console.log( params['test'] );} );



function animate() {

    requestAnimationFrame( animate );

    if (modelData && atomsData) {
        // required if controls.enableDamping or controls.autoRotate are set to true
        controls.update();

        renderer.render( scene, camera );
    }

}
// animate();