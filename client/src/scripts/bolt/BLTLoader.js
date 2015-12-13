
var WORKER_CLOSE = "CLOSE";

THREE.BLTLoader = function () {};

THREE.BLTLoader.prototype = {

	constructor: THREE.BLTLoader

};

THREE.BLTLoader.prototype.closeWorker = function(worker) {
    var message = {};
    message.operation = WORKER_CLOSE;
    worker.postMessage(message);
    if (worker.name && this.workers.hasOwnProperty(worker.name)) {
        this.workers[worker.name] = null;
        delete this.workers[worker.name];
    }
};

THREE.BLTLoader.prototype.load = function ( data, onSuccessCallback, onErrorCallback ) {
    var worker = new Worker('./bolt/BLTWorker.js');

    var self = this;
    var bltData = data;

    if(!bltData){
        onErrorCallback();
    }

    var postData = {};
    postData['name'] = 'blt';
    postData['args'] = {'data': bltData};
    worker.postMessage(postData);
    var objectMap = {};
    var nodeTextures = {};
    var fradId = 0;
    var currentNodeId = '';
    var geometries = [];

    var indexCount = 0, positionCount = 0, normalCount = 0, uvCount = 0;

    worker.onmessage = function(e) {
        var msg;
        msg = e.data;
        var args = msg['args'];
        var geometry, pos, texture;
        switch (msg['name']) {
        case 'EOF':
            if (onSuccessCallback) {
                onSuccessCallback(geometries);
            }

            self.closeWorker(worker);
            break;
        case 'createScene':
            var value = msg['args'];
            break;
        case 'createMesh':
            var meshid = args['id'];
            geometry = new THREE.BufferGeometry();
            objectMap[meshid] = geometry;
            break;
        case 'createNode':
            var nodeid = args['id'];
            // Support for multi-textures, each node can have submeshes(but we don't implement this in the scene gragh), and have one texture image applied.
            currentNodeId = nodeid;
            break;
        case 'setPrim':
            geometry = objectMap[args['id']];
            var primType = args['primType'];
            var prim = new Uint32Array(args['data']);
            for (var _i = 0, _len = prim.length; _i < _len; _i++) {
                if (!(_i + 2 < _len && prim[_i + 1] === 0 && prim[_i + 2] === 0 && prim[_i] === 0)) {
                    continue;
                }
                prim = prim.subarray(0, _i);
                break;
            }
            geometry.addAttribute('index', new THREE.BufferAttribute(prim,1));
            indexCount += prim.length;
            break;
        case 'setPos':
            geometry = objectMap[args['id']];
            pos = new Float32Array(args['data']);
            geometry.addAttribute('position', new THREE.BufferAttribute(pos,3));
            positionCount += pos.length;
            break;
        case 'setNorm':
            geometry = objectMap[args['id']];
            var normal = new Float32Array(args['data']);
            geometry.addAttribute('normal', new THREE.BufferAttribute(normal,3));
            normalCount += normal.length;
            break;
        case 'setTex':
            geometry = objectMap[args['id']];
            var uv = new Float32Array(args['data']);
            geometry.addAttribute('uv', new THREE.BufferAttribute(uv,2));
            uvCount += uv.length;
            break;
        case 'appendChild':
            geometry = objectMap[args['childId']];
            texture = nodeTextures[args['parentId']];
            if (geometry) {
                geometry.material = {};
                geometry.material.mapTexture = texture;
                geometry.computeBoundingSphere();
                geometry.computeBoundingBox();
                geometries.push(geometry);
            }
            fradId++;
            break;
        case 'createSurfaceStyle':
            break;
        case 'setSurfaceStyle':
            break;
        case 'createTexture':
            var textureid = args['id'];
            data = new Uint8Array(args['width'] * args['height'] * 3);
            texture = new THREE.DataTexture(data, args['width'], args['height'], THREE.RGBFormat, THREE.UnsignedByteType);
            texture.flipY = false;
            nodeTextures[currentNodeId] = texture;
            texture = {'width' : args['width'], 'height': args['height'], 'data': data, 'threetexture': texture};
            objectMap[textureid] = texture;
            break;
        case 'setTextureTile':
            var data = args['data'];
            var offset = args['offset'];
            var size = args['size'];
            var arrayData = new Uint8ClampedArray(data);
            texture = objectMap[args['id']];

            // Do flip to make sure the texture data can be applied correctly. Disabled flipY on DataTexture, since that doesn't work
            // for combined texture tiles.
            pos = 0;
            for (var j = 0; j < size[1]; ++j) {
                for (var i = 0; i < size[0]; ++i) {
                    pos = ((offset[1] + j) * texture.width + offset[0] + i) * 3;
                    texture.data[pos] = arrayData[((size[1] - j - 1) * size[0] + i) * 4];
                    texture.data[pos + 1] = arrayData[((size[1] - j - 1) * size[0] + i) * 4 + 1];
                    texture.data[pos + 2] = arrayData[((size[1] - j - 1) * size[0] + i) * 4 + 2];
                }
            }
            texture.threetexture.needsUpdate = true;
            break;
        case 'endBlock':
            break;
        case 'log':
            break;
        case 'setRootBounds':
            // NOTE: Bounding box is read from the header, so we can initialze by the bounding box. Currently we don't read the blt by
            // streaming, so this isn't needed.
            break;
        default:
            console.log('bad message from worker');
            break;
        }

        worker.onerror = function(e) {
            self.logger.log('blt load error');
        };

        worker.postMessage( {'name': 'start', 'args': {} });
    }

};