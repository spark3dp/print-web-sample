'use strict';

var ThreeJS = require('./ThreeJS.js');
var Spark = require('./Spark.js');
var Status = require('./SparkStatus.js');

//==================================

function loadBoltData(data, mesh, diffuseColor, transformEnabled) {
    return new Promise(function (resolve, reject) {
        console.log('Start parse Bolt xform: ' + transformEnabled + ' id: ' + mesh.id);
        var loader = new THREE.BLTLoader();
        return loader.load(data, function (geometry) {
            ThreeJS.createSceneObject(geometry, mesh.name, mesh.transform, diffuseColor, transformEnabled)
                .then(function (object) {
                    if (object) {
                        resolve(object);
                    } else {
                        reject(new Error('Failed to create viewable from geometry data.'));
                    }
                });
        });
    });
}

function cleanMesh(mesh) {
    if (mesh && mesh.visual) {
        ThreeJS.uncacheVisual(mesh.visual_id);
        mesh.visual = null;
    }
}

//==================================

var PrintModel = function (importedMesh, parent, isSupport) {
    var _this = this;

    var kImportColor = 0xCCCC66;
    var kRepairOkColor = 0x66CC66;
    var kRepairNotOkColor = 0xFF5555;
    var kPreparedColor = 0x6688CC;
    var kSupportColor = 0xCC2288;

    this.parent = parent;
    this.importMesh = importedMesh;
    this.isSupport = isSupport;
    this.repairedMesh = null;
    this.preparedMesh = null;
    this.transformMesh = null;
    this.currentVisual = null;
    this.isLaidOut = false;
    this.newMatrix = null;

    this.getId = function () {
        return this.importMesh.id;
    };

    this.getImportMesh = function () {
        return this.importMesh;
    };

    this.updateMesh = function (newMesh) {
        this.importMesh = newMesh;
    };

    this.getMeshId = function () {
        var mesh = this.getMesh() || {};
        return mesh.id;
    };

    this.getMesh = function () {
        return this.preparedMesh || this.transformMesh || this.repairedMesh || this.importMesh;
    };

    this.visualiseMesh = function(mesh, diffuseColor, transformEnabled) {
        if (mesh.visual) {
            this.show(mesh.visual);
            return Promise.resolve(mesh.visual);
        }
        var cached = ThreeJS.getVisual(mesh.visual_file_id, transformEnabled);
        if (cached) {
            mesh.visual = cached;
            mesh.visual_id = mesh.visual_file_id;
            ThreeJS.cacheVisual(mesh.visual_id, cached); // Bump ref count.
            this.show(mesh.visual);
            return Promise.resolve(mesh.visual);
        }
        console.log('Start download BLT, selectable=' + transformEnabled);
        return ADSKSpark.Files.downloadFile(mesh.visual_file_id)
            .then(function (response) {
                return loadBoltData(response.arraybuffer.buffer, mesh, diffuseColor, transformEnabled);
            })
            .then(function (visual) {
                console.log('Visual[' + mesh.id + ']=' + (transformEnabled ? 'selectable' : 'non-selectable'));
                mesh.visual = visual;
                mesh.visual_id = mesh.visual_file_id;
                ThreeJS.cacheVisual(mesh.visual_id, visual);
                _this.show(visual);
                return visual;
            });
    };

    this.visualiseMesh(importedMesh, isSupport ? kSupportColor : kImportColor, false)
        .catch(function (error) {
            Status.MessageAction.error('ERROR: ' + error.message);
        });

    this.repaired = function (repairedMesh) {
        this.repairedMesh = repairedMesh;
        var color = (repairedMesh.problems.length === 0) ? kRepairOkColor : kRepairNotOkColor;

        return this.visualiseMesh(repairedMesh, color, false);
    };

    this.prepared = function (preparedMesh, transformEnabled) {
        console.log('New prepared mesh: ' + preparedMesh.id + ' xform: ' + JSON.stringify(preparedMesh.transform));
        if (transformEnabled) {
            this.transformMesh = preparedMesh;
        } else {
            this.preparedMesh = preparedMesh;
        }
        this.isLaidOut = true;

        return this.visualiseMesh(preparedMesh, kPreparedColor, transformEnabled);
    };

    this.transformed = function (member, oldMatrix, newMatrix) {
        _this.newMatrix = newMatrix;
        _this.isLaidOut = true;
        // console.log('XFORM OLD:' + JSON.stringify(oldMatrix));
        // console.log('XFORM NEW:' + JSON.stringify(newMatrix));
    };

    this.updateTransform = function (session) {

        // If the transform has been updated we need to push it up
        // to the server. Returns a Promise that resolves to the
        // mesh with the correct transform (either the current one
        // or an updated one).
        if (!this.newMatrix) {
            return Promise.resolve(this.getMesh());
        }
        var transform = ThreeJS.getSparkTransform(this.newMatrix);
        console.log('Pushing ' + this.getMesh().id + ' XFORM: ' + JSON.stringify(transform));
        return session.transform(this.getMesh(), transform)
            .then(function (mesh) {
                console.log('XFORMed id: ' + mesh.id);
                _this.transformMesh = mesh;
                _this.newMatrix = null;
                return mesh;
            });
    };

    this.clean = function () {
        this.hide();

        [this.preparedMesh, this.transformMesh, this.repairedMesh, this.importMesh].forEach(function(mesh) {
            cleanMesh(mesh);
        });
    };

    this.hide = function () {
        if (this.currentVisual) {
            ThreeJS.removeModel(this.currentVisual);
            this.currentVisual = null;
        }
    };

    this.show = function (visual) {
        // console.log('Show mesh: ' + mesh.id + ' viz: ' + mesh.visual_file_id + ' = ' + typeof(visual));
        if (visual && visual !== this.currentVisual) {
            this.hide();
            ThreeJS.addModel(visual);
            this.currentVisual = visual;

            if (visual.matrix.onChange) {
                visual.matrix.onChange(this, this.transformed);
            }
        }
    };

    this.unprepare = function (newLayout) {
        if (newLayout) {
            this.isLaidOut = false;
        }
        cleanMesh(this.preparedMesh);
        this.preparedMesh = null;
        this.show(this.getMesh().visual);
    };
};

//==================================

var PrintModels = function () {
    var _this = this;

    this.models = {};
    this.transformsEnabled = false;

    // Instantiate a Spark Data session object.
    // This keeps track of the meshes and the current tray.
    // The tray will trigger when a prepare has completed.
    // The supports are triggered when the export completes.
    this.session = new Spark.Session();

    //=====================================================
    // Store trigger callbacks. Use _this in these methods:
    //
    this.onMeshImported = function (mesh) {
        // console.log('Adding new model for mesh: ' + mesh.id);
        _this.add(mesh);

        _this.session.analyse(mesh)
            .catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    };

    this.onMeshRepaired = function (inputId, repaired) {
        _this.get(inputId).repaired(repaired);
    };

    this.onMeshAnalysed = function (mesh) {
        _this.updateMesh(mesh);

        if (mesh.problems.length > 0) {
            var message = 'Mesh analysis found problems: ';
            for (var i = 0; i < mesh.problems.length; ++i) {
                if (i > 0) {
                    message += ', ';
                }
                message += mesh.problems[i].type;
            }
            throw( new Error(message) );
            // Status.MessageAction.message(message, 1);
        }
    };

    this.onLayoutTrayChange = function (preparedTray) {
        // TODO: if (!tray.ready) ???

        var meshArray = preparedTray.meshes;
        _this.prepared(meshArray, true);
    };

    this.onSupportTrayChange = function (preparedTray) {
        // TODO: if (!tray.ready) ???

        var meshArray = preparedTray.meshes;
        _this.prepared(meshArray, false);
    };

    this.onSupportsChange = function (supportMeshes) {
        _this.newSupports(supportMeshes);
    };

    this.onPrintableReady = function (printableId, operation) {
        if (_this.printableCallback) {
            _this.printableCallback(printableId, operation);
        }
    };

    //==================================

    this.session.Imports.listen(this.onMeshImported);
    this.session.Repairs.listen(this.onMeshRepaired);
    this.session.Analysed.listen(this.onMeshAnalysed);
    this.session.LayoutTray.listen(this.onLayoutTrayChange);
    this.session.SupportTray.listen(this.onSupportTrayChange);
    this.session.Supports.listen(this.onSupportsChange);
    this.session.Printable.listen(this.onPrintableReady);

    //==================================

    this.add = function (mesh, isSupport) {
        this.models[mesh.id] = new PrintModel(mesh, this, isSupport);
    };

    this.remove = function (id) {
        if (id in this.models) {
            this.models[id].clean();
            delete this.models[id];
        }
    };

    this.get = function (id) {
        return this.models[id];
    };

    this.allowTransforms = function (state) {
        this.transformsEnabled = state;
    };

    this.repair = function (operation) {
        // TODO: Progress reports for multiple simultaneous operations
        // may not work so well.
        var repairs = [];
        for (var id in this.models) {
            repairs.push(this.session.repair(this.models[id].getImportMesh(), operation));
        }
        return Promise.all(repairs);
    };

    this.prepare = function (withSupports, operation) {
        console.log('prepare: ' + operation);

        // NOTE: we will have to lock out certain operations while
        // we're waiting for these in order to avoid inconsistencies
        // in the data.
        //
        function next(meshes) {
            var meshIds = [];
            var meshAttributes = [];
            var i = 0;

            // The meshes passed in are the ones that have the latest transform.
            // These are in the same order as the model traversal since they
            // come from the Promise.all(xforms) below.
            for (var id in _this.models) {
                var model = _this.models[id];
                var isLaidOut = model.isLaidOut;
                var attributes = {
                    reposition: !isLaidOut,
                    reorient: !isLaidOut,
                    support: withSupports
                };

                meshIds.push(meshes[i].id);
                meshAttributes.push(attributes);

                console.log('Create tray: mesh[' + meshes[i].id + ']: ' + JSON.stringify(attributes));
                console.log('            xform:' + JSON.stringify(meshes[i].transform));

                ++i;
            }
            // console.log('Prepare ' + meshIds.length + ' meshes');
            return _this.session.createAndPrepareTray(meshIds, meshAttributes, withSupports, operation);
        }

        var xforms = [];
        for (var id in this.models) {
            xforms.push(this.models[id].updateTransform(this.session));
        }
        return Promise.all(xforms)
            .then(next);
    };

    this.unprepare = function (newLayout) {
        for (var id in this.models) {
            if (this.models[id].isSupport) {
                this.remove(id);
            } else {
                this.models[id].unprepare(newLayout);
            }
        }
        this.session.unprepare();
    };

    this.generatePrintable = function (operation, printableCallback) {
        this.printableCallback = printableCallback;
        return this.session.generatePrintable(operation);
    };

    this.uploadAndImport = function (file, withVisual, operation) {
        return this.session.uploadAndImport(file, withVisual, operation);
    };

    this.prepared = function (preparedMeshes, allowTransform) {
        // NOTE: the order of these meshes will match the order
        // of the mesh id's given to create tray. The model list must
        // not change while waiting for this response.

        var i = 0;
        for (var id in this.models) {
            var model = this.models[id];
            model.prepared(preparedMeshes[i], allowTransform);
            ++i;
        }
    };

    this.updateMesh = function (mesh) {
        if (mesh.id in this.models) {
            this.models[mesh.id].updateMesh(mesh);
        }
    };

    this.newSupports = function (supportMeshes) {
        for (var id in supportMeshes) {
            this.add(supportMeshes[id], true);
        }
    };
};

module.exports = PrintModels;
