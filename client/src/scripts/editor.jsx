'use strict';

var PrinterSelection = require('./PrinterSelectStore.js');
var PrinterSelectUi = require('./PrinterSelectUi.jsx');
var Settings = require('./SettingStore.js');
var SettingDialog = require('./SettingDialog.jsx');

var Status = require('./SparkStatus.js');
var Subway = require('./Subway.jsx');
var ThreeJS = require('./ThreeJS.js');

// TODO: Handle logout action properly.
// TODO: Handle select different printer.
// TODO: Lots of other stuff.

// Given an array of filenames, return the first filename that
// has an 'obj' file extension.
//
function findObj(filenames) {
    for (var i = 0; i < filenames.length; ++i) {
        var filename = filenames[i];
        var parts = filename.split('.');
        var length = parts.length;
        var ext = (1 < length && parts[0] !== '') ? parts[length - 1] : '';
        if (ext.toLowerCase() === 'obj') {
            return filename;
        }
    }

    return null;
}

var initialized = false;

var PrinterUI = React.createClass({
    mixins: [
        Reflux.connect(PrinterSelection.Store),
        Reflux.connect(Settings.Store)
    ],

    onPrinterClicked: function () {
        this.refs.printerSelectUi.show();
    },

    onProfileClicked: function () {
        this.refs.settingDialog.show();
    },

    getInitialState: function () {
        this._currentPrinterTypeId = null;
    },

    componentWillUpdate: function () {
        var selectedPrinterTypeId = PrinterSelection.Store.getSelectedPrinterTypeId();
        if (selectedPrinterTypeId !== this._currentPrinterTypeId) {
            this._currentPrinterTypeId = selectedPrinterTypeId;
        }
    },

    render: function () {
        var printer = PrinterSelection.Store.state.printer;
        var printerType = PrinterSelection.Store.state.printerType;
        var profile = Settings.Store.state.profile;

        var iconSrc = printerType ? printerType.icons['200x60_id'] : null;

        var printerName;
        if (printer) {
            printerName = printer.printer_name;
        } else if (printerType) {
            printerName = printerType.name + ' (type)';
        }

        var profileName = profile ? profile.name : null;

        return (
            <div className="printer-ui">
                <div className="printer-icon"><img src={iconSrc}/></div>

                <div className="printer-profile-select">
                    <button className="btn btn-default printer-select-button" type="button"
                            onClick={this.onPrinterClicked}>Printer...
                    </button>
                    <span className="printer-select-name">{printerName}</span>
                    <br/>
                    <button className="btn btn-default profile-select-button" type="button"
                            onClick={this.onProfileClicked}>Settings...
                    </button>
                    <span className="profile-select-name">{profileName}</span>
                </div>
                <PrinterSelectUi ref="printerSelectUi"/>
                <SettingDialog ref="settingDialog"/>
            </div>
        );
    }
});

var ThreeJSviewer = React.createClass({
    mixins: [Reflux.connect(PrinterSelection.Store)],

    getInitialState: function () {
        this._currentPrinterTypeId = null;
        this._currentPrintBed = null;
    },

    componentDidMount: function () {
        if (!initialized) {
            // We have to initialize Three.js here *after* the render method has
            // completed so that editor element exists in the DOM hierarchy.
            var $canvas = $('.editor');
            ThreeJS.initialize($canvas.get(0));
            // ThreeJS.animate(true);

            initialized = true;
        }
    },

    componentWillUnmount: function () {
        // ThreeJS.animate(false);
    },

    // TODO: show material.

    renderPrintBed: function () {
        var _this = this;
        var selectedPrinterType = PrinterSelection.Store.state.printerType;
        if (selectedPrinterType) {
            var selectedPrinterTypeId = selectedPrinterType.id;
            if (selectedPrinterTypeId !== this._currentPrinterTypeId) {
                this._currentPrinterTypeId = selectedPrinterTypeId;

                this.downloadPrintBed(selectedPrinterType.build_volume.bed_file_id)
                    .then(function (printBed) {
                        if (_this._currentPrintBed) {
                            ThreeJS.removeModel(_this._currentPrintBed);
                            _this._currentPrintBed = null;
                        }

                        var unzip = new Zlib.Unzip(printBed.arraybuffer);
                        var filename = findObj(unzip.getFilenames());
                        if (!filename) {
                            Status.MessageAction.error('No print bed found for \"' + selectedPrinterType.name + '\"');
                            return;
                        }

                        var bedObj = unzip.decompress(filename);
                        var dataView = new DataView(bedObj.buffer);
                        var decoder = new TextDecoder();
                        var decodedString = decoder.decode(dataView);
                        var object3d = new THREE.OBJLoader().parse(decodedString);

                        // Make the print bed transparent:
                        /*
                        var meshes = object3d.children;
                        for( var n=meshes.length; --n >= 0; ) {
                            var mat = meshes[n].material;
                            mat.opacity = 0.5;
                            mat.transparent = true;
                        }
                        */
                        _this._currentPrintBed = object3d;

                        // https://searchcode.com/codesearch/view/83337781/ for the MTLLoader.js
                        // bedMtl = unzip.decompress(filenames[1]);
                        // dataView = new DataView(bedMtl.buffer);
                        // decodedString = decoder.decode(dataView);
                        // var mtlLoader = new THREE.MTLLoader();
                        // var response = mtlLoader.parse(decodedString);

                        // object3d.applyMatrix(this.ThreeJS.importMatrix);
                        ThreeJS.addModel(object3d);

                    }).catch(function (error) {
                        Status.MessageAction.error(error.message);
                    });
            }
        }
    },

    downloadPrintBed: function (url) {
        var promise = new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            if ('withCredentials' in xhr) {
                // XHR for Chrome/Firefox/Opera/Safari.
                xhr.open('GET', url, true);
            } else if (typeof XDomainRequest !== 'undefined') {
                // XDomainRequest for IE.
                xhr = new XDomainRequest();
                xhr.open('GET', url);
            } else {
                xhr.open('GET', url);
            }

            xhr.responseType = 'arraybuffer';

            xhr.onload = function () {
                if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202 || xhr.status === 204) {
                    var response = {};
                    response.arraybuffer = new Uint8Array(xhr.response);
                    resolve(response);

                } else {
                    var error = new Error(xhr.statusText);
                    error.status = xhr.status;
                    error.statusText = xhr.statusText;
                    error.responseText = xhr.responseText;
                    reject(error);
                }
            };
            xhr.onerror = function (err) {
                reject(new Error('Error: ' + url + ' failed: ' + err.message));
            };

            xhr.send();
        });
        return promise;
    },

    render: function () {
        this.renderPrintBed();
        return <canvas id="canvas" className="editor"/>;
    }
});


var Editor = React.createClass({
    render: function () {
        return (
            <div className="print-studio-editor">
                <div className="editor-ui">
                    <PrinterUI/>
                    <Subway.Buttons/>
                </div>
                <ThreeJSviewer/>
            </div>);
    }
});

module.exports = Editor;
