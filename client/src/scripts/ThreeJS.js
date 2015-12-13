// Our Three.js setup:
//
module.exports = (function () {
    'use strict';

    var selectableCache = {};
    var nonSelectableCache = {};
    var animateId;
    var FUDGE = 8;
    var _this, camera, canvas, controls, scene, renderer;

    var ref =  function (cache, id, object) {
        var found = cache[id];
        if (found && found === object) {
            found.refCount = found.refCount ? (found.refCount + 1) : 1;
            console.log('viz[' + id + '] ref=' + found.refCount);
            return cache[id];
        }
        if (found) {
            console.log('CLOBBER! viz[' + id + '] ref=' + found.refCount);
            delete cache[id];
        }
        cache[id] = object;
        object.refCount = 1;
        return object;
    };

    var unref =  function (cache, id) {
        var found = cache[id];
        if (found) {
            found.refCount = found.refCount ? (found.refCount - 1) : 0;

            console.log('viz[' + id + '] ref=' + found.refCount);
            if (found.refCount <= 0) {
                delete cache[id];
            }
        }
    };

    function createObject(buffers, diffuse) {
        var newObject = new THREE.Object3D();

        for (var i = 0, l = buffers.length; i < l; i++) {
            var material = new THREE.MeshPhongMaterial({color: diffuse, specular: 0x333333});
            material.name = 'hack';

            var mesh = new THREE.Mesh(buffers[i], material);
            mesh.name = 'merge';

            newObject.add(mesh);
        }
        return newObject;
    }


    return {
        _onWindowResize: function() {
            _this.resize();
        },

        _run: function() {
            animateId = requestAnimationFrame( _this._run );
            controls.update();
        },

        animate: function(state) {
            if (state && !animateId) {
                this._run();
            } else if (!state && animateId) {
                cancelAnimationFrame(animateId);
                animateId = null;
            }
        },


        render: function() {
            renderer.render( scene, camera );
        },

        initialize: function(element) {
            _this = this;
            canvas = element

            var bounds = element.getBoundingClientRect();
            var canvasW = window.innerWidth;
            var canvasH = window.innerHeight - bounds.top - FUDGE;

            camera = new THREE.PerspectiveCamera( 60, canvasW / canvasH, 0.01, 1000 );
            camera.position.z = 10;
            camera.position.y = -10;
            camera.up.x = 0;
            camera.up.y = 0;
            camera.up.z = 1;

            controls = new THREE.OrbitControls( camera, canvas );

            controls.enableRotate = true;
            controls.enablePan = true;
            controls.enableZoom = true;
            controls.enableDamping = true;

            controls.rotateSpeed = 0.1;
            controls.keyPanSpeed = 7.0;	// pixels moved per arrow key push
            controls.zoomSpeed = 0.5;
            controls.dampingFactor = 0.3;

            controls.keys = [ 65, 83, 68 ];
            controls.addEventListener( 'change', this.render );

            // world

            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

            var grid = new THREE.GridHelper(10, 1);
            grid.rotateX(THREE.Math.degToRad(90.0));
            grid.setColors(0x882222, 0x888888);
            scene.add(grid);

            // lights
            var light;

            light = new THREE.DirectionalLight( 0xffffff );
            light.position.set( 1, 1, 1 );
            scene.add( light );

            light = new THREE.DirectionalLight( 0x555555 );
            light.position.set( -1, -1, 1 );
            scene.add( light );

            light = new THREE.AmbientLight( 0x222222 );
            scene.add( light );

            // renderer

            renderer = new THREE.WebGLRenderer( { canvas: canvas, antialias: false } );
            renderer.setClearColor( scene.fog.color );
            renderer.setPixelRatio( window.devicePixelRatio );

            // canvas = renderer.domElement;
            // container.appendChild( canvas );

            renderer.setSize( canvasW, canvasH, false );

            /*
            stats = new Stats();
            stats.domElement.style.position = 'absolute';
            stats.domElement.style.top = '0px';
            stats.domElement.style.zIndex = 100;
            canvas.parent.appendChild( stats.domElement );
            */

            //

            window.addEventListener( 'resize', this._onWindowResize, false );
            //

            this.render();
        },

        resize: function() {
            var bounds = canvas.getBoundingClientRect();
            var w = window.innerWidth;
            var h = window.innerHeight - bounds.top - FUDGE;

            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize( w, h, false );
            this.render();
        },

        setFileImportCallback: function(/*callback*/) {
        },

        addModel: function (obj) {
            scene.add(obj);
            this.render();
        },

        removeModel: function (obj) {
            scene.remove(obj);
            this.render();
        },

        getMatrix4: function (sparkXform) {
            var matrix = new THREE.Matrix4();
            if (sparkXform) {
                console.log('Mesh xform: ' + JSON.stringify(sparkXform));
                matrix.set(sparkXform[0][0], sparkXform[0][1], sparkXform[0][2], sparkXform[0][3],
                    sparkXform[1][0], sparkXform[1][1], sparkXform[1][2], sparkXform[1][3],
                    sparkXform[2][0], sparkXform[2][1], sparkXform[2][2], sparkXform[2][3],
                    0, 0, 0, 1);
            }
            return matrix;
        },

        getSparkTransform: function (m4) {
            var spark = [];
            var m = m4.elements;
            spark.push([m[0], m[4], m[8], m[12]]);
            spark.push([m[1], m[5], m[9], m[13]]);
            spark.push([m[2], m[6], m[10], m[14]]);
            return spark;
        },

        createSceneObject: function (geometries, name, transform, diffuseColor/*, transformEnabled*/) {
            var obj = createObject(geometries, diffuseColor);
            obj.applyMatrix(this.getMatrix4(transform));
            return Promise.resolve(obj);
        },

        cacheVisual: function (id, visual) {
            // console.log('cache[' + id + '] = ' + typeof(visual));
            var cache = (visual instanceof THREE.Object3D) ? nonSelectableCache :  selectableCache;
            ref( cache, id, visual);
        },

        uncacheVisual: function (id) {
            unref( selectableCache, id );
            unref( nonSelectableCache, id);
        },

        getVisual: function (id, selectable) {
            // If preferred choice isn't available return the other.
            // Preferred one should show up and get updated.
            return selectable ? (selectableCache[id] || nonSelectableCache[id])
                : (nonSelectableCache[id] || selectableCache[id]);
        }
    };
}());
