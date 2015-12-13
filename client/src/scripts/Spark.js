'use strict';

var PrinterSelect = require('./PrinterSelectStore.js');
var Settings = require('./SettingStore.js');
var Status = require('./SparkStatus.js');

var Spark = Spark || {};

Spark.Session = function () {
    this.uploadFiles = [];
    this.importedMeshes = [];

    this.Imports = Reflux.createStore({
        init: function () {
            this.meshes = {};
        },

        ids: function () {
            return Object.keys(this.meshes);
        },

        count: function () {
            return Object.keys(this.meshes).length;
        },

        addMesh: function (mesh) {
            this.meshes[mesh.id] = mesh;
            this.trigger(mesh);
        },

        updateMesh: function (mesh) {
            if (mesh.id in this.meshes) {
                this.meshes[mesh.id] = mesh;
                // No trigger here.
            }
        }
    });

    this.Repairs = Reflux.createStore({
        init: function () {
            this.meshes = {};
        },

        ids: function () {
            // This mesh list is indexed by the import Id.
            var idList = [];
            for (var importId in this.meshes) {
                idList.push(this.meshes[importId].id);
            }
            return idList;
        },

        count: function () {
            return Object.keys(this.meshes).length;
        },

        clear: function () {
            if (Object.keys(this.meshes).length > 0) {
                this.meshes = {};
                this.trigger(null);
            }
        },

        addMesh: function (inputMeshId, repairedMesh) {
            this.meshes[inputMeshId] = repairedMesh;
            this.trigger(inputMeshId, repairedMesh);
        },

        retrigger: function (inputMeshId) {
            this.trigger(inputMeshId, this.meshes[inputMeshId]);
        }
    });

    // We use a separate store to distinguish analyse from import.
    // Is there a way to have different types of triggers from the same store?
    // Analysed meshes will be in both stores.
    this.Analysed = Reflux.createStore({
        init: function () {
            this.meshes = {};
        },

        ids: function () {
            return Object.keys(this.meshes);
        },

        count: function () {
            return Object.keys(this.meshes).length;
        },

        addMesh: function (mesh) {
            this.meshes[mesh.id] = mesh;
            this.trigger(this.meshes[mesh.id]);
        }
    });

    this.LayoutTray = Reflux.createStore({
        init: function () {
            this.tray = null;
        },

        setTray: function (tray) {
            // console.log('Set Layout Tray: ' + JSON.stringify(tray));
            this.tray = tray;
            this.trigger(this.tray);
        },

        retrigger: function () {
            this.trigger(this.tray);
        }
    });

    this.SupportTray = Reflux.createStore({
        init: function () {
            this.tray = null;
        },

        setTray: function (tray) {
            // console.log('Set Support Tray: ' + JSON.stringify(tray));
            this.tray = tray;
            this.trigger(this.tray);
        },

        retrigger: function () {
            this.trigger(this.tray);
        }
    });

    this.Supports = Reflux.createStore({
        init: function () {
            this.meshes = {};
        },

        ids: function () {
            return Object.keys(this.meshes);
        },

        count: function () {
            return Object.keys(this.meshes).length;
        },

        setMeshes: function (meshes) {
            this.meshes = meshes;
            this.trigger(this.meshes);
        }
    });

    this.Printable = Reflux.createStore({
        init: function () {
            this.id = null;
            this.operation = null;
        },

        setPrintable: function (fileId, operation) {
            this.operation = operation;
            this.id = fileId;
            if (fileId) {
                this.trigger(this.id, operation);
            }
        },

        retrigger: function (operation) {
            this.operation = operation;
            this.trigger(this.id, operation);
        }
    });

    this.analyse = function (mesh) {
        var _this = this;

        return ADSKSpark.MeshAPI.analyzeMesh(mesh.id)
            .then(function (mesh) {
                _this.Analysed.addMesh(mesh);
                _this.Imports.updateMesh(mesh);
                return mesh;
            });
    };

    this.transform = function (mesh, transform) {
        // var _this = this;
        return ADSKSpark.MeshAPI.transformMesh(mesh.id, transform);
        // .then( ??? );
    };

    this.uploadAndImport = function (file, withVisual, operation) {
        var _this = this;

        var importProgress = function (progress) {
            // Import is the second half of this operation...
            Status.ProgressAction.progress(operation, 0.5 + 0.5 * progress);
        };

        function startImport(result) {
            var fileInfo = result.files[0];
            fileInfo.name = file.name;
            _this.uploadFiles.push(fileInfo);

            console.log('Importing: ' + fileInfo.name);
            // Status.MessageAction.message('Importing: ' + fileInfo.file_id);
            return ADSKSpark.MeshAPI.importMesh(fileInfo.file_id, fileInfo.name, withVisual, undefined, importProgress);
        }

        // TODO: How do we get progress updates for the upload?
        Status.ProgressAction.start(operation);
        Status.ProgressAction.progress(operation, 0.25);   // Punt for now.

        return ADSKSpark.Files.uploadFile({file: file})
            .then(startImport)
            .then(function (mesh) {
                importProgress(1.0);
                _this.Imports.addMesh(mesh);
                return mesh;
            });
    };

    this.repair = function (mesh, operation) {
        var _this = this;

        // Beware of running multiple repairs at the same time.
        // TODO: change this method to take an array of mesh ids ?
        var repairProgress = function (progress) {
            Status.ProgressAction.progress(operation, progress, mesh.id);
        };

        if (mesh.id in this.Repairs.meshes) {
            repairProgress(1.0);

            // Retriggering causes another Bolt file download. 
            // Is it necessary?
            // this.Repairs.retrigger(mesh.id);

            return Promise.resolve(mesh);
        }
        Status.ProgressAction.start(operation);
        ADSKSpark.MeshAPI.repairMesh(mesh.id, true, true, repairProgress)
            .then(function (repairedMesh) {
                repairProgress(1.0);
                _this.Repairs.addMesh(mesh.id, repairedMesh);
            });
    };


    this.createAndPrepareTray = function (meshIds, attributes, withSupports, operation) {
        var _this = this;

        function createTray(meshIds) {
            function createProgress(progress) {
                Status.ProgressAction.progress(operation, progress * (withSupports ? 0.3 : 0.5));
            }

            if (!meshIds.length) {
                return Promise.reject(new Error('No meshes to prepare'));
            }
            var selectedPrinterTypeId = PrinterSelect.Store.state.printerType.id;
            var selectedProfileId = Settings.Store.state.profile.id;

            var meshAttributes = {};
            for (var i = 0; i < meshIds.length; i++) {
                meshAttributes[meshIds[i]] = attributes[i];
            }
            var material = Settings.Store.state.material;
            var materialId = material ? material.id : undefined;
            // Status.MessageAction.message('Create tray with ' + meshIds.length + ' meshes');
            return ADSKSpark.TrayAPI.createTray(selectedPrinterTypeId, selectedProfileId, meshIds, meshAttributes, materialId, createProgress);
        }

        function prepareTray(tray) {
            function prepareProgress(progress) {
                Status.ProgressAction.progress(operation, (withSupports ? 0.3 : 0.5) + progress * 0.5);
            }

            // Status.MessageAction.message('Prepare tray: ' + tray.id);
            //
            // TODO: if the mesh is already repaired or prepared we don't need to
            // generate and download the visual every time. We just have to update
            // the transform on the existing visual. This will make some operations
            // much faster.
            //
            return ADSKSpark.TrayAPI.prepareTray(tray.id, true, prepareProgress)
                .then(function (preparedTray) {
                    prepareProgress(1.0);
                    var store = withSupports ? _this.SupportTray : _this.LayoutTray;
                    store.setTray(preparedTray);
                    return preparedTray;
                });
        }

        function exportSupports(preparedTray) {
            function exportProgress(progress) {
                Status.ProgressAction.progress(operation, 0.8 + progress * 0.2);
            }

            return ADSKSpark.TrayAPI.exportSupports(preparedTray.id, null, true, exportProgress)
                .then(function (supportMeshes) {
                    // console.log('Supports: ' + JSON.stringify(supportMeshes));
                    exportProgress(1.0);
                    _this.Supports.setMeshes(supportMeshes);
                });
        }

        function noWorkToDo(tray, meshIds, attributes) {
            var trayMeshes = tray.meshes;
            for (var i = 0; i < meshIds.length; i++) {
                if (!trayMeshes[i] || trayMeshes[i].id !== meshIds[i]) {
                    return false;
                }
                var attr = attributes[i];
                if (attr.reposition || attr.reorient || attr.support) {
                    return false;
                }
            }
            return true;
        }

        // A layout request on a tray that is already laid out can
        // return immediately. Must also check if the mesh id's have changed.
        var store = withSupports ? _this.SupportTray : _this.LayoutTray;
        if (store.tray && store.tray.ready && noWorkToDo(store.tray, meshIds, attributes)) {
            Status.ProgressAction.progress(operation, 1.0);
            store.retrigger();
            return Promise.resolve(store.tray);
        }
        this.Printable.setPrintable(null);
        Status.ProgressAction.start(operation);

        var prepare = createTray(meshIds).then(prepareTray);

        if (withSupports) {
            prepare.then(exportSupports);
        }
        return prepare;
    };

    this.unprepare = function () {
        // TODO: Consider triggering these and let the listener clean up.
        this.SupportTray.tray = null;
        this.Supports.meshes = {};
    };


    this.generatePrintable = function (operation) {
        function printableProgress(progress) {
            Status.ProgressAction.progress(operation, progress);
        }

        if (!this.SupportTray.tray || !this.SupportTray.tray.ready) {
            return Promise.reject(new Error('The print tray has not been successfully prepared.'));
        }
        // Status.MessageAction.message('Preparing model for printer');
        var _this = this;

        Status.ProgressAction.start(operation);
        if (this.Printable.id) {
            printableProgress(1.0);
            this.Printable.retrigger(operation);
            return Promise.resolve(this.Printable.id);
        }

        // TODO: Check if we have a printable already.
        return ADSKSpark.TrayAPI.generatePrintable(this.SupportTray.tray.id, printableProgress)
            .then(function (printable) {
                printableProgress(1.0);
                _this.Printable.setPrintable(printable.file_id, operation);
            });
    };
};

module.exports = Spark;
