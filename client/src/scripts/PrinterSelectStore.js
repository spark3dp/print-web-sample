'use strict';

var Login = require('./LoginStore.js');
var PrintManager = require('./PrintManagerStore.js');
var Status = require('./SparkStatus.js');
var utilities = require('./utilities.js');

// Define some bitfields. We use this in _trigger() so that we reduce the
// number of trigger() events.
//
var DATA_PRINTERS = 1 << 0;
var DATA_PRINTER_TYPES = 1 << 1;
var DATA_ALL = DATA_PRINTERS | DATA_PRINTER_TYPES;

var Actions = Reflux.createActions([
    'selectPrinter',
    'selectPrinterType',
    'refresh'
]);

var Store = Reflux.createStore({
    listenables: [Actions],

    init: function () {
        this.state = {
            printers: [],
            printerTypes: [],
            printer: null,
            printerType: null
        };

        this._dataWaiting = DATA_ALL;

        this.listenTo(Login.Store, this._loginStoreChanged);
        var loginStoreState = Login.Store.state;
        if (loginStoreState.isLoggedIn) {
            this._loginStoreChanged(loginStoreState);
        }

        this.listenTo(PrintManager.Store, this._printManagerStoreChanged);
    },

    getInitialState: function () {
        return this.state;
    },

    _loginStoreChanged: function (state) {
        if (state.isLoggedIn) {
            this._getPrinters();
            this._getPrinterTypes();
        } else {
            this._dataWaiting = DATA_ALL;
            this.state.printers = [];
            this.state.printerTypes = [];
            this.state.printer = null;
            this.state.printerType = null;
            this.trigger(this.state);
        }
    },

    _printManagerStoreChanged: function (state) {
        if (!Login.Store.state.isLoggedIn) {
            return;
        }

        var oldPrinterIds = this.state.printers.map(function (printer) {
            return printer.printer_id;
        }).sort();

        var newPrinterIds = state.printers.map(function (printer) {
            return printer.printer_id;
        }).sort();

        if (!utilities.isEqualArray(oldPrinterIds, newPrinterIds)) {
            this._getPrinters();
        }
    },

    onSelectPrinter: function (id) {
        if (!this.state.printer || this.state.printer.printer_id !== id) {
            this.state.printer = this.getPrinterFromId(id);
            this.state.printerType = null;
            this._normalize();
            this.trigger(this.state);
        }
    },

    onSelectPrinterType: function (id) {
        if (this.state.printer || !this.state.printerType || this.state.printerType.id !== id) {
            this.state.printerType = this.getPrinterTypeFromId(id);
            this.state.printer = null;
            this._normalize();
            this.trigger(this.state);
        }
    },

    onRefresh: function () {
        this._getPrinters();
    },

    getSelectedPrinterId: function () {
        return this.state.printer ? this.state.printer.printer_id : null;
    },

    getSelectedPrinterTypeId: function () {
        return this.state.printerType ? this.state.printerType.id : null;
    },

    getSelectedPrinterIndex: function () {
        if (this.state.printer) {
            var id = this.state.printer.printer_id;
            return utilities.findIndex(this.state.printers, function (printer) {
                return id === printer.printer_id;
            });
        }
        return -1;
    },

    getSelectedPrinterTypeIndex: function () {
        if (this.state.printerType) {
            var id = this.state.printerType.id;
            return utilities.findIndex(this.state.printerTypes, function (printerType) {
                return id === printerType.id;
            });
        }
        return -1;
    },

    getPrinterFromId: function (id) {
        return utilities.find(this.state.printers, function (printer) {
            return printer.printer_id === id;
        });
    },

    getPrinterTypeFromId: function (id) {
        return utilities.find(this.state.printerTypes, function (printerType) {
            return printerType.id === id;
        });
    },

    getPrinterTypeFromPrinter: function (printer) {
        if (printer) {
            var id = printer.type_id;
            return utilities.find(this.state.printerTypes, function (printerType) {
                return id === printerType.id;
            });
        }
        return null;
    },

    getPrinterTypeFromPrinterId: function (id) {
        return this.getPrinterTypeFromPrinter(this.getPrinterFromId(id));
    },

    _normalize: function () {
        if (this._dataWaiting) {
            return;
        }

        var printers = this.state.printers;
        var printerTypes = this.state.printerTypes;
        var printer, printerType, id;

        // Selected printer must be valid printer.
        //
        if (this.state.printer) {
            id = this.state.printer.printer_id;
            printer = utilities.find(printers, function (item) {
                return id === item.printer_id;
            });

            if (!printer) {
                this.state.printer = null;
            }
        }

        // Selected printer type must be valid printer type.
        //
        if (this.state.printerType) {
            id = this.state.printerType.id;
            printerType = utilities.find(printerTypes, function (item) {
                return id === item.id;
            });

            if (!printerType) {
                this.state.printerType = null;
            }
        }

        // No selected printer and no selected printer type?
        // Pick first online printer or last printer.
        //
        if (!this.state.printer && !this.state.printerType && printers && printers.length) {
            printer = utilities.find(printers, function (item) {
                return item.printer_last_health === 'online';
            });

            this.state.printer = printer || printers[printers.length - 1];
        }

        // If we have a selected printer, use it to set selected printer type.
        //
        if (this.state.printer) {
            id = this.state.printer.type_id;
            this.state.printerType = utilities.find(printerTypes, function (item) {
                return id === item.id;
            });
        }

        // No selected printer type?
        // Pick ember as default; otherwise, pick first one.
        // We only do this if we've already queried for printers and there are none.
        //
        if (!this.state.printerType && printerTypes && printerTypes.length) {
            id = '7FAF097F-DB2E-45DC-9395-A30210E789AA';
            this.state.printerType = utilities.find(printerTypes, function (item) {
                return id === item.id;
            });

            if (!this.state.printerType) {
                this.state.printerType = printerTypes[0];
            }
        }
    },

    _getPrinters: function () {
        var that = this;
        ADSKSpark.Printers.get({limit: -1})
            .then(function (printers) {
                that._dataWaiting &= ~DATA_PRINTERS;
                that.state.printers = printers;
                that._normalize();
                that._trigger();
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    },

    _getPrinterTypes: function () {
        var that = this;
        ADSKSpark.PrintDB.getPrinterTypes()
            .then(function (printerTypes) {
                that._dataWaiting &= ~DATA_PRINTER_TYPES;
                that.state.printerTypes = printerTypes;
                that._normalize();
                that._trigger();
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    },

    _trigger: function () {
        if (!this._dataWaiting) {
            this.trigger(this.state);
        }
    }
});

module.exports = {
    Actions: Actions,
    Store: Store
};
