'use strict';

var Login = require('./LoginStore.js');
var PrinterSelect = require('./PrinterSelectStore.js');
var Status = require('./SparkStatus.js');
var utilities = require('./utilities.js');

// Define some bitfields. We use this in _trigger() so that we reduce the
// number of trigger() events.
//
var DATA_MATERIALS = 1 << 0;
var DATA_PROFILES = 1 << 1;
var DATA_ALL = DATA_MATERIALS | DATA_PROFILES;

var Actions = Reflux.createActions([
    'selectMaterial',
    'selectProfile',
    'autofit',
    'changeSettings'
]);

var Store = Reflux.createStore({
    listenables: [Actions],

    init: function () {
        this.state = {
            materials: [],
            material: null,
            profiles: [],
            profile: null,
            settings: {},
            autofit: true
        };

        this._schemas = {};
        this._schemas.DLP = require('../assets/schemas/EmberConfig.json');
        this._schemas.FDM = require('../assets/schemas/TorpedoConfig.json');

        this._dataWaiting = DATA_ALL;

        this._currentPrinterTypeId = null;
        this._currentProfileId = null;

        this.listenTo(Login.Store, this._loginStoreChanged);
        var loginStoreState = Login.Store.state;
        if (loginStoreState.isLoggedIn) {
            this._loginStoreChanged(loginStoreState);
        }

        this.listenTo(PrinterSelect.Store, this._printerSelectStoreChanged);
    },

    getInitialState: function () {
        return this.state;
    },

    _loginStoreChanged: function (state) {
        if (state.isLoggedIn) {
            this._getMaterials();
            this._getProfiles();
        } else {
            this._dataWaiting = DATA_ALL;
            this._currentPrinterTypeId = null;
            this._currentProfileId = null;

            this.state.profiles = [];
            this.state.profile = null;
            this.state.settings = {};
            this.trigger(this.state);
        }
    },

    _printerSelectStoreChanged: function () {
        if (this._currentPrinterTypeId !== PrinterSelect.Store.getSelectedPrinterTypeId()) {
            this._normalize();
            this.trigger(this.state);
        }
    },

    onSelectProfile: function (id) {
        if (!this.state.profile || this.state.profile.id !== id) {
            this.state.profile = this.getProfileFromId(id);
            this._normalize();
            this.trigger(this.state);
        }
    },

    onAutofit: function (autofit) {
        if (this.state.autofit !== autofit) {
            this.state.autofit = autofit;
            this.trigger(this.state);
        }
    },

    onChangeSettings: function (newValues) {
        var changed = false;

        for (var prop in newValues) {
            if (newValues.hasOwnProperty(prop)) {
                var oldValue = this.state.settings[prop];
                if (oldValue !== undefined) {
                    var newValue = newValues[prop];
                    if (newValue !== oldValue) {
                        this.state.settings[prop] = newValue;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            this.trigger(this.state);
        }
    },

    getMaterialsForSelectedPrinterType: function () {
        var printerType = PrinterSelect.Store.state.printerType;
        if (printerType) {
            var id = printerType.id;
            return this.state.materials.filter(function (material) {
                return material.printer_types.indexOf(id) !== -1;
            });
        }
        return [];
    },

    getProfilesForSelectedPrinterType: function () {
        var printerType = PrinterSelect.Store.state.printerType;
        if (printerType) {
            var id = printerType.id;
            return this.state.profiles.filter(function (profile) {
                return profile.printer_types.indexOf(id) !== -1;
            });
        }
        return [];
    },

    getSelectedMaterialId: function () {
        return this.state.material ? this.state.material.id : null;
    },

    getSelectedProfileId: function () {
        return this.state.profile ? this.state.profile.id : null;
    },

    getSelectedMaterialIndex: function () {
        if (this.state.material) {
            var id = this.state.material.id;
            return utilities.findIndex(this.state.materials, function (material) {
                return id === material.id;
            });
        }
        return -1;
    },

    getSelectedProfileIndex: function () {
        if (this.state.profile) {
            var id = this.state.profile.id;
            return utilities.findIndex(this.state.profiles, function (profile) {
                return id === profile.id;
            });
        }
        return -1;
    },

    getMaterialFromId: function (id) {
        return utilities.find(this.state.materials, function (material) {
            return material.id === id;
        });
    },

    getProfileFromId: function (id) {
        return utilities.find(this.state.profiles, function (profile) {
            return profile.id === id;
        });
    },

    getSchema: function () {
        var printerType = PrinterSelect.Store.state.printerType;
        return printerType ? this._schemas[printerType.technology] : null;
    },

    _normalize: function () {
        if (this._dataWaiting) {
            return;
        }

        var materials = this.state.materials;
        var profiles = this.state.profiles;
        var printerType = PrinterSelect.Store.state.printerType;
        var material, profile, id;

        // No printer type means no selected material, selected profile, settings.
        //
        if (!printerType) {
            this._currentPrinterTypeId = null;
            this._currentProfileId = null;

            this.state.material = null;
            this.state.profile = null;
            this.state.settings = {};

            return;
        }

        // Selected material must be valid material.
        //
        if (this.state.material) {
            id = this.state.material.id;
            material = utilities.find(materials, function (item) {
                return id === item.id;
            });

            if (!material) {
                this.state.material = null;
            }
        }

        // Selected material must match selected printer type.
        //
        if (printerType && this.state.material) {
            id = printerType.id;
            if (this.state.material.printer_types.indexOf(id) === -1) {
                this.state.material = null;
            }
        }

        // No selected material?
        // Pick selected printer type's default material or first material.
        //
        if (printerType && !this.state.material && materials && materials.length) {
            this.state.material = this.getMaterialFromId(printerType.default_material_id);

            if (!this.state.material) {
                id = printerType.id;
                this.state.material = utilities.find(materials, function (item) {
                    return item.printer_types.indexOf(id) !== -1;
                });
            }
        }

        // Selected profile must be valid profile.
        //
        if (this.state.profile) {
            id = this.state.profile.id;
            profile = utilities.find(profiles, function (item) {
                return id === item.id;
            });

            if (!profile) {
                this.state.profile = null;
            }
        }

        // Selected profile must match selected printer type.
        //
        if (printerType && this.state.profile) {
            id = printerType.id;
            if (this.state.profile.printer_types.indexOf(id) === -1) {
                this.state.profile = null;
            }
        }

        // No selected profile?
        // Pick selected printer type's default profile or first profile.
        //
        if (printerType && !this.state.profile && profiles && profiles.length) {
            this.state.profile = this.getProfileFromId(printerType.default_profile_id);

            if (!this.state.profile) {
                id = printerType.id;
                this.state.profile = utilities.find(profiles, function (item) {
                    return item.printer_types.indexOf(id) !== -1;
                });
            }
        }

        // Printer type changed or profile changed?
        // Initialize settings from schema defaults and override with profile.
        //
        profile = this.state.profile;
        if ((printerType && printerType.id !== this._currentPrinterTypeId) ||
            (profile && profile.id !== this._currentProfileId)) {

            this._currentPrinterTypeId = printerType.id;

            this.state.settings = {};
            var schema = this.getSchema();
            if (schema) {
                for (var i = 0, length = schema.length; i < length; ++i) {
                    var setting = schema[i];
                    if (setting.in_use === undefined || setting.in_use) {
                        this.state.settings[setting.name] = setting.default;
                    }
                }
            }

            if (profile) {
                this._currentProfileId = profile.id;

                for (var prop in profile) {
                    if (profile.hasOwnProperty(prop) && (this.state.settings[prop] !== undefined)) {
                        this.state.settings[prop] = profile[prop];
                    }
                }
            }
        }
    },

    _getMaterials: function () {
        var that = this;
        ADSKSpark.PrintDB.getMaterial()
            .then(function (data) {
                that._dataWaiting &= ~DATA_MATERIALS;
                that.state.materials = data.materials || [];
                that._normalize();
                that._trigger();
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    },

    _getProfiles: function () {
        var that = this;
        ADSKSpark.PrintDB.getProfile(null, {limit: -1})
            .then(function (data) {
                that._dataWaiting &= ~DATA_PROFILES;
                that.state.profiles = data.profiles || [];
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
