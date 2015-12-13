var IS_WORKER = (typeof self !== 'undefined') && (typeof window === 'undefined');

var worker = self;
if (IS_WORKER)
{
    if (typeof IS_CONCAT_BUILD === 'undefined' || !IS_CONCAT_BUILD)
    {
        //Everything below will get compiled into the worker JS during build

        importScripts('./zlib.min.js');
        importScripts('./jpegimage.js');
    }

    var PrimitiveTypeEnum, SB_Message, SB_MessageData, SB_MessageQueue, SceneBuilder, _ref,
      __hasProp = {}.hasOwnProperty,
      __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

    PrimitiveTypeEnum = {
      'IndexedTriangleList': 1
    };

    SB_Message = (function() {
      function SB_Message(msg) {
        this.msg = msg;
      }

      SB_Message.prototype.dispatch = function() {
        return postMessage(this.msg);
      };

      SB_Message.prototype.isEndBlock = function() {
        return this.msg['name'] === 'endBlock';
      };

      return SB_Message;

    })();

    SB_MessageData = (function() {
      function SB_MessageData(msg, buffers) {
        this.msg = msg;
        this.buffers = buffers;
      }

      SB_MessageData.prototype.dispatch = function() {
        return postMessage(this.msg, this.buffers);
      };

      SB_MessageData.prototype.isEndBlock = function() {
        return false;
      };

      return SB_MessageData;

    })();

    SB_MessageQueue = (function() {
      function SB_MessageQueue() {
        this.backlog = [];
        this.paused = true;
      }

      SB_MessageQueue.prototype.post = function(msg) {
        //if (this.paused) {
        //  return this.backlog.push(new SB_Message(msg));
        //} else {
       return postMessage(msg);
        //}
      };

      SB_MessageQueue.prototype.postData = function(msg, buffers) {
        //if ((this.backlog.length > 0) || this.paused) {
         // return this.backlog.push(new SB_MessageData(msg, buffers));
        //} else {
        return postMessage(msg, buffers);
        //}
      };

      SB_MessageQueue.prototype.pause = function() {
        return this.paused = true;
      };

      SB_MessageQueue.prototype.resume = function() {
        this.paused = false;
        return this.postBacklog();
      };

      SB_MessageQueue.prototype.postBacklog = function() {
        var i, l, msg;
        if (this.backlog.length === 0) {
          return;
        }
        l = this.backlog.length;
        i = 0;
        while (i < l) {
          msg = this.backlog[i++];
          msg.dispatch();
          if (msg.isEndBlock()) {
            if (i < l) {
              this.backlog = this.backlog.slice(i);
            } else {
              this.backlog = [];
            }
            this.pause();
            return;
          }
        }
      };

      return SB_MessageQueue;

    })();

    SceneBuilder = (function(_super) {
      __extends(SceneBuilder, _super);

      function SceneBuilder() {
        _ref = SceneBuilder.__super__.constructor.apply(this, arguments);
        return _ref;
      }

      SceneBuilder.prototype.constuctor = function() {
        return this.nextId = 0;
      };

      SceneBuilder.prototype.getNextId = function() {
        var id;
        if (this.nextId == null) {
          this.nextId = 0;
        }
        id = this.nextId;
        this.nextId += 1;
        return '_obj_' + id;
      };

      SceneBuilder.prototype.createScene = function() {
        var id;
        id = this.getNextId();
        this.post({
          'name': 'createScene',
          'args': {
            'id': id
          }
        });
        return id;
      };

      SceneBuilder.prototype.createMesh = function() {
        var id;
        id = this.getNextId();
        this.post({
          'name': 'createMesh',
          'args': {
            'id': id
          }
        });
        return id;
      };

      SceneBuilder.prototype.setPrim = function(mesh, primType, data) {
        return this.postData({
          'name': 'setPrim',
          'args': {
            'id': mesh,
            'primType': primType,
            'data': data.buffer
          }
        }, [data.buffer]);
      };

      SceneBuilder.prototype.setPos = function(mesh, data) {
        return this.postData({
          'name': 'setPos',
          'args': {
            'id': mesh,
            'data': data.buffer
          }
        }, [data.buffer]);
      };

      SceneBuilder.prototype.setNorm = function(mesh, data) {
        return this.postData({
          'name': 'setNorm',
          'args': {
            'id': mesh,
            'data': data.buffer
          }
        }, [data.buffer]);
      };

      SceneBuilder.prototype.setTex = function(mesh, data) {
        return this.postData({
          'name': 'setTex',
          'args': {
            'id': mesh,
            'data': data.buffer
          }
        }, [data.buffer]);
      };

      SceneBuilder.prototype.appendChild = function(parent, child) {
        return this.post({
          'name': 'appendChild',
          'args': {
            'parentId': parent,
            'childId': child
          }
        });
      };

      SceneBuilder.prototype.createNode = function() {
        var id;
        id = this.getNextId();
        this.post({
          'name': 'createNode',
          'args': {
            'id': id
          }
        });
        return id;
      };

      SceneBuilder.prototype.createSurfaceStyle = function(namespace, params) {
        var id;
        id = this.getNextId();
        this.post({
          'name': 'createSurfaceStyle',
          'args': {
            'id': id,
            'namespace': namespace,
            'params': params
          }
        });
        return id;
      };

      SceneBuilder.prototype.setSurfaceStyle = function(node, style) {
        return this.post({
          'name': 'setSurfaceStyle',
          'args': {
            'node': node,
            'style': style
          }
        });
      };

      SceneBuilder.prototype.createTexture = function(width, height) {
        var id;
        id = this.getNextId();
        this.post({
          'name': 'createTexture',
          'args': {
            'id': id,
            'width': width,
            'height': height
          }
        });
        return id;
      };

      SceneBuilder.prototype.setTextureTile = function(id, offset, size, data) {
        return this.postData({
          'name': 'setTextureTile',
          'args': {
            'id': id,
            'offset': offset,
            'size': size,
            'data': data.buffer
          }
        }, [data.buffer]);
      };

      SceneBuilder.prototype.setRootBounds = function(bounds, length) {
        return this.postData({
          'name': 'setRootBounds',
          'args': {
            'data': {'bound': bounds, 'size': length}
          }
        });
      };

      SceneBuilder.prototype.endBlock = function() {
        this.post({
          'name': 'endBlock',
          'args': {}
        });
        return this.pause();
      };

      SceneBuilder.prototype.end = function() {
        return this.post({
          'name': 'EOF',
          'args': {}
        });
      };

      SceneBuilder.prototype.flush = function() {};

      return SceneBuilder;

    })(SB_MessageQueue);

    var BltToScene;

    BltToScene = (function() {
      /**
      *  @constructor  create scene root by given viewable data and keyword we used to add to the scene manager map.
      *  @param {Object} data viewable data.
      *  @param {String} keyword keyword we used to add to the scene manager map.
      *  @param {Boolean} twoSided whether or not need set two sided rendering mode in the created mesh nodes.
      */

      function BltToScene(sceneBuilder) {
        /*
        * Parsing context
        */

        this.messageCount = 0;
        this.sceneBuilder = sceneBuilder;
        /*
        * Other Parameters
        */

        this.root = void 0;
        this.shaderNodes = [];
        this.bolt = {};
        this.canvas = void 0;
        this.arrayToClient = [];
        this.imageToShader = [];
        this.attribToMesh = [];
        this.indexToMesh = [];
      }

      BltToScene.prototype.onJsonMessage = function(msg) {};

      BltToScene.prototype.onBinaryMessage = function(msg, index) {
        if (index == null) {
          return this.parseHeaderStructure(msg);
        } else {
          return this.parseDataBlock(msg, index);
        }
      };

      BltToScene.prototype.parseBltFile = function(bltData) {
        var block, blockData, blockSize, i, startIdx, _i, _len, _ref;
        this.parseHeaderStructure(bltData);
        startIdx = 16 + this.bolt.header.structureSize;
        _ref = this.bolt.structure.blocks;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          block = _ref[i];
          blockSize = block.size;
          blockData = bltData.slice(startIdx, startIdx + blockSize);
          startIdx += blockSize;
          this.parseDataBlock(blockData, i);
        }
        return this.sceneBuilder.end();
      };

      BltToScene.prototype.parseHeaderStructure = function(buffer) {
        var headerUlongs, headerUshorts, jsonData, structureBuffer;
        this.root = this.sceneBuilder.createScene();
        headerUlongs = new Uint32Array(buffer, 0, 16);
        if (headerUlongs[0] !== undefined && !headerUlongs[0] === 0x51AC7461) {
          throw 'bad bolt file, header tag error: ' + magicNum;
        }

        headerUshorts = new Uint16Array(buffer, 0, 16);
        this.bolt.header = {
          version: headerUshorts[2].toString() + '.' + headerUshorts[3].toString(),
          structureSize: headerUlongs[2],
          fileSize: headerUlongs[3]
        };
        structureBuffer = new Uint8Array(buffer, 16, this.bolt.header.structureSize);
        this.cursor = 16 + this.bolt.header.structureSize;
        jsonData = this.decodeJSON(structureBuffer);
        return this._setHeaderJSON(jsonData);
      };

      BltToScene.prototype._setHeaderJSON = function(jsonData) {
        var attrib, image, index, obj, shader, shaderID, tile, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
        this.bolt.structure = jsonData;
        /*
        * For each shader in the file, create a shading group and add to the root.
        * and for each image ref, add a referece back to shader, and add a the imageref to the
        * list of imageRefs for an image.
        */

        shaderID = 0;
        _ref = this.bolt.structure.shaders;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          shader = _ref[_i];
          this.initShader(shader, shaderID);
          shaderID++;
        }
        _ref1 = this.bolt.structure.objects;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          obj = _ref1[_j];
          obj.shader = this.bolt.structure.shaders[obj.shaderID];
          obj.arrayCount = 0;
          _ref2 = obj.attribs;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            attrib = _ref2[_k];
            attrib.obj = obj;
            attrib._type = 'attr';
            this.arrayToClient[attrib.arrayID] = attrib;
            obj.arrayCount += 1;
          }
          if (obj.indices != null) {
            index = obj.indices;
            index.obj = obj;
            index._type = 'indx';
            this.arrayToClient[index.arrayID] = index;
            obj.arrayCount += 1;
          }
        }
        _ref3 = this.bolt.structure.objects;
        for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
          obj = _ref3[_l];
          if (this.bolt.structure.bounds) {
            this.bolt.structure.bounds.min.x = this.bolt.structure.bounds.min.x < obj.attribs['0'].range['0'] ? this.bolt.structure.bounds.min.x : obj.attribs['0'].range['0'];
            this.bolt.structure.bounds.min.y = this.bolt.structure.bounds.min.y < obj.attribs['0'].range['1'] ? this.bolt.structure.bounds.min.y : obj.attribs['0'].range['1'];
            this.bolt.structure.bounds.min.z = this.bolt.structure.bounds.min.z < obj.attribs['0'].range['2'] ? this.bolt.structure.bounds.min.z : obj.attribs['0'].range['2'];
            this.bolt.structure.bounds.max.x = this.bolt.structure.bounds.max.x > obj.attribs['0'].range['3'] ? this.bolt.structure.bounds.max.x : obj.attribs['0'].range['3'];
            this.bolt.structure.bounds.max.y = this.bolt.structure.bounds.max.y > obj.attribs['0'].range['4'] ? this.bolt.structure.bounds.max.y : obj.attribs['0'].range['4'];
            this.bolt.structure.bounds.max.z = this.bolt.structure.bounds.max.z > obj.attribs['0'].range['5'] ? this.bolt.structure.bounds.max.z : obj.attribs['0'].range['5'];
          } else {
            this.bolt.structure.bounds = {};
            this.bolt.structure.bounds.min = {};
            this.bolt.structure.bounds.max = {};
            this.bolt.structure.bounds.min.x = obj.attribs['0'].range['0'];
            this.bolt.structure.bounds.min.y = obj.attribs['0'].range['1'];
            this.bolt.structure.bounds.min.z = obj.attribs['0'].range['2'];
            this.bolt.structure.bounds.max.x = obj.attribs['0'].range['3'];
            this.bolt.structure.bounds.max.y = obj.attribs['0'].range['4'];
            this.bolt.structure.bounds.max.z = obj.attribs['0'].range['5'];
          }
        }
        if (this.bolt.structure.bounds != null) {
          this.sceneBuilder.setRootBounds(this.bolt.structure.bounds, _ref3.length);
        }
        _ref4 = this.bolt.structure.images;
        for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
          image = _ref4[_m];
          image.arrayCount = 0;
          _ref5 = image.tiles;
          for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
            tile = _ref5[_n];
            tile.image = image;
            tile._type = 'tile';
            this.arrayToClient[tile.arrayID] = tile;
            image.arrayCount += 1;
          }
        }
        return this.numberBlocks = this.bolt.structure.blocks.length;
      };

      BltToScene.prototype.parseDataBlock = function(buffer, id) {
        var arrayID, block, blockBuffer, blockCursor, blockData, byteLength, client, _i, _ref, _ref1;
        block = this.bolt.structure.blocks[id];
        blockData = new Uint8Array(buffer);
        blockBuffer = buffer;
        if (block.compression === 'zlib') {
          blockData = this.inflateArrayBuffer(blockData);
          blockBuffer = blockData.buffer;
          if ((blockData.byteOffset !== 0) || (blockData.length !== blockBuffer.byteLength)) {
            blockBuffer = blockBuffer.slice(blockData.byteOffset, blockData.byteOffset + blockData.length);
            blockData = new Uint8Array(blockBuffer);
          }
        }
        blockCursor = 0;
        for (arrayID = _i = _ref = block.arrays[0], _ref1 = block.arrays[1]; _ref <= _ref1 ? _i < _ref1 : _i > _ref1; arrayID = _ref <= _ref1 ? ++_i : --_i) {
          client = this.arrayToClient[arrayID];
          byteLength = 0;
          if (client._type === 'indx') {
            switch (client.format) {
              case 'uint16':
                byteLength = 2 * client.size;
                client.buffer = blockBuffer.slice(blockCursor, blockCursor + byteLength);
                client.arrayTyped = this.decodeUint16IndexBuffer(client.buffer, client.size);
                break;
              default:
                throw 'unsupported index format: ' + client.format;
            }
            this.setMeshIndexBuffer(client);
          } else if (client._type === 'attr') {
            switch (client.format) {
              case 'single':
                byteLength = client.dim * client.size * 4;
                client.buffer = blockBuffer.slice(blockCursor, blockCursor + byteLength);
                client.arrayTyped = this.decodeSingleAttributeBuffer(client.buffer, client.size, client.dim);
                break;
              default:
                throw 'unsupported attr format: ' + client.format;
            }
            this.setMeshAttributeBuffer(client);
          } else if (client._type === 'tile') {
            byteLength = client.arraySize;
            client.buffer = blockBuffer.slice(blockCursor, blockCursor + byteLength);
            this.decodeTileBuffer(client);
            this.setImageTile(client);
          } else {
            throw 'unsupported client type: ' + client._type;
          }
          blockCursor += byteLength;
        }
        return this.sceneBuilder.endBlock();
      };

      BltToScene.prototype.inflateArrayBuffer = function(encodedData) {
        var decodedData, inflate;
        inflate = new Zlib.Inflate(encodedData);
        decodedData = inflate.decompress();
        return decodedData;
      };

      BltToScene.prototype.utf8ByteArrayToString = function(data) {
        var c, c1, c2, charBuf, len, subStr, subStrs, utf8Str, _lo;
        len = data.length;
        subStrs = [];
        charBuf = [];
        _lo = 0;
        while (_lo < len) {
          c = data[_lo];
          if (c < 128) {
            charBuf.push(String.fromCharCode(c));
            _lo += 1;
          } else if ((c > 191) && (c < 224)) {
            c1 = data[_lo + 1];
            charBuf.push(String.fromCharCode(((c & 31) << 6) | (c1 & 63)));
            _lo += 2;
          } else {
            c1 = data[_lo + 1];
            c2 = data[_lo + 2];
            charBuf.push(String.fromCharCode(((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63)));
            _lo += 3;
          }
          if (charBuf.length > 1024) {
            subStr = charBuf.join('');
            subStrs.push(subStr);
            charBuf = [];
          }
        }
        if (charBuf.length > 0) {
          subStr = charBuf.join('');
          subStrs.push(subStr);
        }
        utf8Str = subStrs.join('');
        return utf8Str;
      };

      BltToScene.prototype.decodeJSON = function(encodedData) {
        var bytes, strJSON;
        bytes = this.inflateArrayBuffer(encodedData);
        strJSON = this.utf8ByteArrayToString(bytes);
        return JSON.parse(strJSON);
      };

      BltToScene.prototype.transposeUint8Array = function(src, nr, nc) {
        var c, dest, i, j, r, _i, _j;
        dest = new Uint8Array(nc * nr);
        for (r = _i = 0; 0 <= nr ? _i < nr : _i > nr; r = 0 <= nr ? ++_i : --_i) {
          for (c = _j = 0; 0 <= nc ? _j < nc : _j > nc; c = 0 <= nc ? ++_j : --_j) {
            i = r * nc + c;
            j = c * nr + r;
            dest[i] = src[j];
          }
        }
        return dest;
      };

      BltToScene.prototype.transposeFloat32Array = function(src, nr, nc) {
        var c, dest, i, j, r, _i, _j;
        dest = new Float32Array(nc * nr);
        for (r = _i = 0; 0 <= nr ? _i < nr : _i > nr; r = 0 <= nr ? ++_i : --_i) {
          for (c = _j = 0; 0 <= nc ? _j < nc : _j > nc; c = 0 <= nc ? ++_j : --_j) {
            i = r * nc + c;
            j = c * nr + r;
            dest[i] = src[j];
          }
        }
        return dest;
      };

      BltToScene.prototype.decodeUint16IndexBuffer = function(buffer, nr) {
        var dest, i, src, temp, _i;
        src = new Uint8Array(buffer, 0, 2 * nr);
        temp = this.transposeUint8Array(src, nr, 2);
        dest = new Uint16Array(temp.buffer);
        for (i = _i = 0; 0 <= nr ? _i < nr : _i > nr; i = 0 <= nr ? ++_i : --_i) {
          //Fix for indices values off by 1;
          dest[i] += i - 1;
          // dest[i] += i;
          if (dest[i] == 65534) {
            dest[i]++;
          }
        }
        return dest;
      };

      BltToScene.prototype.decodeSingleAttributeBuffer = function(buffer, nr, ne) {
        var dest, src, temp, temp2;
        src = new Uint8Array(buffer, 0, 4 * nr * ne);
        temp = this.transposeUint8Array(src, nr * ne, 4);
        temp2 = new Float32Array(temp.buffer);
        dest = this.transposeFloat32Array(temp2, nr, ne);
        return dest;
      };

      BltToScene.prototype.decodeTileBuffer = function(client) {
        var height, img, jpgData, width;
        jpgData = new Uint8Array(client.buffer);
        img = new JpegImage();
        img.parse(jpgData);
        width = client['size'][0];
        height = client['size'][1];
        client['imageData'] = {
          'width': width,
          'height': height,
          'data': img.getData(width, height)
        };
      };

      BltToScene.prototype.setMeshIndexBuffer = function(client) {
        var obj;
        obj = client.obj;
        obj.arrayCount -= 1;
        if (obj.arrayCount === 0) {
          return this.convertObjToMesh(obj);
        }
      };

      BltToScene.prototype.setMeshAttributeBuffer = function(client) {
        var obj;
        obj = client.obj;
        obj.arrayCount -= 1;
        if (obj.arrayCount === 0) {
          return this.convertObjToMesh(obj);
        }
      };

      BltToScene.prototype.setImageTile = function(tile) {
        if (tile.image._texture != null) {
          return this.sceneBuilder.setTextureTile(tile.image._texture, tile.offset, tile.size, tile.imageData.data);
        }
      };

      BltToScene.prototype.convertObjToMesh = function(obj) {
        var attr, mesh, _i, _len, _ref;
        mesh = obj.mesh = this.sceneBuilder.createMesh();
        if (obj.indices.format !== 'uint16') {
          throw 'Index buffer is ' + obj.indices.format + ', not uint16';
        }
        switch (obj.indices.type) {
          case 'triangles':
            this.sceneBuilder.setPrim(mesh, PrimitiveTypeEnum.IndexedTriangleList, obj.indices.arrayTyped);
            obj.indices.arrayTyped = void 0;
            break;
          case 'triStrips':
            this.sceneBuilder.setPrim(mesh, PrimitiveTypeEnum.IndexedTriangleList, this.tristripToIndexedTriangleList(obj.indices.arrayTyped));
            obj.indices.arrayTyped = void 0;
            break;
          case 'lines':
            throw 'primType lines';
            break;
          case 'lineStrips':
            throw 'primType lineStrips';
        }
        _ref = obj.attribs;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attr = _ref[_i];
          if (attr.format !== 'single') {
            throw 'non-single attr.format: ' + attr.format;
          }
          switch (attr.semantics) {
            case 'vertices':
              this.sceneBuilder.setPos(mesh, attr.arrayTyped);
              attr.arrayTyped = void 0;
              break;
            case 'normals':
              this.sceneBuilder.setNorm(mesh, attr.arrayTyped);
              attr.arrayTyped = void 0;
              break;
            case 'uvs':
              this.sceneBuilder.setTex(mesh, attr.arrayTyped);
              attr.arrayTyped = void 0;
              break;
            default:
              throw 'unsupported attribute sematic: ' + attr.semantics;
          }
        }
        var parentNode = (obj.shaderID === -1) ? this.root : obj.shader._groupNode;
        return this.sceneBuilder.appendChild(parentNode, mesh);
      };

      BltToScene.prototype.tristripToIndexedTriangleList = function(indexBuffer) {
        var ccw, i0, i1, i2, iOut, l, maxTriangles, n, outIndexBuffer, triangleCount, _i;
        l = indexBuffer.length;
        maxTriangles = l - 2;
        outIndexBuffer = new Uint32Array(maxTriangles * 3);
        ccw = true;
        triangleCount = 0;
        iOut = 0;
        i0 = indexBuffer[0];
        i1 = indexBuffer[1];
        for (n = _i = 2; 2 <= l ? _i < l : _i > l; n = 2 <= l ? ++_i : --_i) {
          i2 = indexBuffer[n];
          if (!((i0 === i1) || (i1 === i2) || (i2 === i0) || (i2 === 65535) || (i1 === 65535) || (i0 === 65535))) {
            outIndexBuffer[iOut++] = i0;
            if (ccw) {
              outIndexBuffer[iOut++] = i1;
              outIndexBuffer[iOut++] = i2;
            } else {
              outIndexBuffer[iOut++] = i2;
              outIndexBuffer[iOut++] = i1;
            }
            triangleCount += 1;
          } else {
            ccw = false;
          }
          ccw = !ccw;
          i0 = i1;
          i1 = i2;
        }
        if (triangleCount !== maxTriangles) {
          outIndexBuffer = new Uint32Array(outIndexBuffer.buffer, 0, triangleCount * 3);
        }
        return outIndexBuffer;
      };

      BltToScene.prototype.initShader = function(shader, shaderID) {
        var imageRef, imgNo, params, _i, _len, _ref;
        shader._groupNode = this.sceneBuilder.createNode();
        this.sceneBuilder.appendChild(this.root, shader._groupNode);
        shader.textures = {};
        imgNo = 0;
        _ref = shader.images;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          imageRef = _ref[_i];
          shader.textures[imageRef.semantics] = this.getTextureForImage(imageRef.imageID);
        }
        params = {
          'illum': 1,
          'ka': [1.0, 1.0, 1.0],
          'kd': [1.0, 1.0, 1.0],
          'ks': [0.0, 0.0, 0.0],
          'ni': 1.0,
          'ns': 10.0
        };
        if (shader.textures['diffuse'] != null) {
          params['map_Kd'] = shader.textures['diffuse'];
          if (shader.textures.ambient != null) {
            params['map_Ka'] = shader.textures['ambient'];
          } else {
            params['map_Ka'] = shader.textures['diffuse'];
          }
        }
        shader._surfaceStyle = this.sceneBuilder.createSurfaceStyle('std.obj', params);
        return this.sceneBuilder.setSurfaceStyle(shader._groupNode, shader._surfaceStyle);
      };

      BltToScene.prototype.getTextureForImage = function(imageID) {
        var image;
        image = this.bolt.structure.images[imageID];
        if (!(image._texture != null)) {
          image._texture = this.sceneBuilder.createTexture(image.size[0], image.size[1]);
        }
        return image._texture;
      };

      return BltToScene;

    })();

    var BGStreamer,
      __hasProp = {}.hasOwnProperty,
      __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

    BGStreamer = (function(_super) {
      __extends(BGStreamer, _super);

      function BGStreamer() {
          BGStreamer.__super__.constructor.apply(this, arguments);
          this.type = void 0;
          this.dataset = void 0;
          this.protocol = void 0;
          this.url = void 0;
          this.streamPath = void 0;
          this.socket = void 0;
          this.streamToScene = void 0;
          this.identifier = 'bubba';
          this.streamToScene = new BltToScene(this);
      }

      BGStreamer.prototype.resume = function() {
          return BGStreamer.__super__.resume.call(this);
      };

      BGStreamer.prototype.onmessage = function(msg) {
          var args, name;
          if ((msg != null)) {
              postLogMessage('onmessage', msg);
              name = msg['name'];
              args = msg['args'];
              switch (name) {
                  case 'start':
                      return this.resume();
                  case 'cancel':
                      return this.cancel();
                  case 'resume':
                      return this.resume();
                  case 'blt':
                      return this.streamToScene.parseBltFile(args.data);
              }
          }
      };

      return BGStreamer;

    })(SceneBuilder);

    self.gWorker = new BGStreamer();

    self.postLogMessage = function(evnt, msg) {
        var log;
        log = {
          'name': 'log',
          'args': {
            'event': evnt,
            'msg': msg
          }
        };
        return self.postMessage(log);
    };

    self.addEventListener('message', function(event) {
        var data = event.data;
        var op = data.operation;

        if(op == "CLOSE"){
            self.close();
        } else {
            self.gWorker.onmessage(data);
        }
    });
}

