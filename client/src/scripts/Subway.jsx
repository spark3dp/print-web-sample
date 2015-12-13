'use strict';

var PrinterSelect = require('./PrinterSelectStore.js');
var PrintModels = require('./PrintModels.js');
var Status = require('./SparkStatus.js');
var ThreeJS = require('./ThreeJS.js');

var STATION = {
    import: 'Import',
    repair: 'Repair',
    layout: 'Layout',
    support: 'Support',
    export: 'Export',
    print: 'Print'
};

var STATIONS = [
    STATION.import,
    STATION.repair,
    STATION.layout,
    STATION.support,
    STATION.export,
    STATION.print
];

var Subway = React.createClass({
    mixins: [
        Reflux.connect(Status.ProgressStore),
        Reflux.connect(PrinterSelect.Store)
    ],

    getInitialState: function () {
        this._buttons = {};
        this._currentPrinterTypeId = null;

        var models = new PrintModels();
        models.allowTransforms(false);

        return {
            models: models,
            station: STATION.import
        };
    },

    componentDidMount: function () {
        var that = this;

        function fileLoadRequest(file) {
            that.state.models.uploadAndImport(file, true, STATION.import)
                .then(function () {
                    that.setState({station: STATION.repair});
                }).catch(function (error) {
                    Status.MessageAction.error('ERROR: ' + error.message);
                });
        }

        ThreeJS.setFileImportCallback(fileLoadRequest);

        $('#file-input').on('change', function (event) {
            var file = event.target.files[0];
            fileLoadRequest(file);
        });

        function makeButton(station) {
            var parent = document.getElementById(station);
            that._buttons[station] = radialProgress(parent)
                .diameter(80)
                .value(0)
                .buttonLabel(station)
                .onClick(that.onStationClicked.bind(that, station))
                .render();
        }

        STATIONS.forEach(function (station) {
            makeButton(station);
        });
    },

    componentWillUpdate: function () {
        var selectedPrinterTypeId = PrinterSelect.Store.getSelectedPrinterTypeId();
        if (selectedPrinterTypeId !== this._currentPrinterTypeId) {
            this._currentPrinterTypeId = selectedPrinterTypeId;
            this.state.models.unprepare(true);
        }
    },

    componentDidUpdate: function () {
        var op = this.state.operation;
        // console.log("UPDATE: OP: " + op + " Progress: " + this.state.progress);
        if (op) {
            // TODO: How do we update multiple button states?
            // This should not be tied to the current operation.
            // Need a separate progress value for each one and
            // update any that have changed here.
            var button = this._buttons[op];
            if (button) {
                if (this.state.progress === 0) {
                    button
                        ._duration(0)   // ???
                        .value(0)
                        .render();
                } else {
                    button
                        ._duration(500) // ???
                        .value(this.state.progress * 100)
                        .render();
                }
            }
        }
    },

    _hasModels: function () {
        return !!Object.keys(this.state.models.models).length;
    },

    _printableReadyForExport: function (printableId, operation) {
        return ADSKSpark.Files.downloadFileByURL(printableId)
            .then(function (fileURL) {
                bootbox.dialog({
                    title: STATION.export,
                    message: '<div>Download printable file  <a href=' + fileURL.download_url + '>here</a></div>'
                });
            })
            .catch(function (error) {
                Status.MessageAction.error(operation + ': ' + error.message);
            });
    },

    _printableReadyForPrint: function (printableId, operation) {
        var printJob = new ADSKSpark.Job();
        var selectedPrinter = PrinterSelect.Store.state.printer;
        return printJob.createWithSettings(null, selectedPrinter.id, printableId)
            .then(function (updatedJob) {
                // TODO: do something useful with the job...
                Status.MessageAction.success('Print Job Created. Status: ' + updatedJob.status);
            })
            .catch(function (error) {
                Status.MessageAction.error(operation + ': ' + error.message);
            });
    },

    onStationClicked: function (station) {
        console.log('onStationClicked(' + station + ')');

        var that = this;
        var changeStation = false;

        switch (station) {
            case STATION.import:
                $('#file-input').click();
                break;

            case STATION.repair:
                if (!this._hasModels()) {
                    Status.MessageAction.error(station + ': Nothing imported');
                    return;
                }
                this.state.models.unprepare();
                this.state.models.repair(station)
                    .catch(function (error) {
                        Status.MessageAction.error('ERROR: ' + error.message);
                    });
                changeStation = true;
                break;

            case STATION.layout:
                if (!this._hasModels()) {
                    Status.MessageAction.error(station + ': Nothing imported');
                    return;
                }
                this.state.models.unprepare();
                this.state.models.repair(STATION.repair)
                    .then(function () {
                        return that.state.models.prepare(false, station);
                    })
                    .catch(function (error) {
                        Status.MessageAction.error('ERROR: ' + error.message);
                        // TODO: Clean up??
                    });
                changeStation = true;
                break;

            case STATION.support:
                if (!this._hasModels()) {
                    Status.MessageAction.error(station + ': Nothing imported');
                    return;
                }
                this.state.models.unprepare();
                this.state.models.repair(STATION.repair)
                    .then(function () {
                        var button = that._buttons[station];
                        if (button) {
                            button._duration(100).value(100).render();
                        }

                        return that.state.models.prepare(true, station);
                    })
                    .catch(function (error) {
                        Status.MessageAction.error('ERROR: ' + error.message);
                        // TODO: Clean up??
                    });
                changeStation = true;
                break;

            case STATION.export:
                if (!this._hasModels()) {
                    Status.MessageAction.error(station + ': Nothing imported');
                    return;
                }
                if (!PrinterSelect.Store.state.printerType) {
                    Status.MessageAction.error(station + ': No printer type selected');
                    return;
                }
                this.state.models.generatePrintable(station, this._printableReadyForExport)
                    .catch(function (error) {
                        Status.MessageAction.error('ERROR: ' + error.message);
                        // TODO: Clean up??
                    });
                changeStation = true;
                break;

            case STATION.print:
                if (!this._hasModels()) {
                    Status.MessageAction.error(station + ': Nothing imported');
                    return;
                }
                if (!PrinterSelect.Store.state.printer) {
                    Status.MessageAction.error(station + ': No printer selected');
                    return;
                }
                this.state.models.generatePrintable(station, this._printableReadyForPrint)
                    .catch(function (error) {
                        Status.MessageAction.error('ERROR: ' + error.message);
                        // TODO: Clean up??
                    });
                changeStation = true;
                break;
        }

        if (changeStation) {
            this.setState({station: station});
            this.state.models.allowTransforms(station === STATION.layout);
        }
    },

    render: function () {
        var border = {borderStyle: 'solid', borderColor: '#b1b1b1', display: 'inline-block', width: '0.5cm', zIndex: 'inherit'};
        var inline = {display: 'inline-block', verticalAlign: 'middle', zIndex: 'inherit', margin: 0, padding: 0};
        return (
            <div className="subway">
                <div style={inline}>
                    <div style={inline} id="Import"></div>
                    <input type="file" id="file-input" name="file-input"></input>
                </div>
                <div style={border}></div>
                <div style={inline} id="Repair"></div>
                <div style={border}></div>
                <div style={inline} id="Layout"></div>
                <div style={border}></div>
                <div style={inline} id="Support"></div>
                <div style={border}></div>
                <div style={inline} id="Export"></div>
                <div style={border}></div>
                <div style={inline} id="Print"></div>
            </div>
        );
    }
});

module.exports = {
    Buttons: Subway
};
