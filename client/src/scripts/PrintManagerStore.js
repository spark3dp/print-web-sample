'use strict';

var Login = require('./LoginStore.js');
var Status = require('./SparkStatus.js');
var utilities = require('./utilities.js');

// Reflux actions and store for a printer management component.
//
// To use this reflux store, you can do something like:
//
// var PrintManager = require('./PrintManager.js');
//
// var Component = React.createClass({
//     mixins: [Reflux.connect(PrintManager.Store)],
//
//     onDeleteClicked: function (printer) {
//         PrintManager.Actions.deletePrinter.triggerPromise(printer)
//             .then(function () {
//                 // Do something on success.
//             }).catch(function (error) {
//                 // Do something on failure.
//             });
//     },
//
//     render: function () {
//         // You can use PrintManager.Store.getPrinterData() here.
//         // You'll need to lookup member ids in this.state.members.
//     }
// });

// TODO:
// Handle adding/removing secondary users for this printer
// Handle deleting a printer when there are secondary users
// After resetPrinter should we watch printer status more closely for a while? If so, how long?
// Waiting for printer status to change after sending job command is a hack
// Would be nice if status changes could be pushed instead of polled
// Sorting/filtering in getPrinterData()

// How often to check printers and printer status?
//
var REFRESH_STATUS_PRINTING = 4 * 1000; // 4 sec
var REFRESH_STATUS_NOT_PRINTING = 30 * 1000; // 30 sec
var REFRESH_PRINTER = 5 * 60 * 1000; // 5 min

// Define some bitfields. We use this in _trigger() so that we reduce the
// number of trigger() events.
//
var DATA_PRINTERS = 1 << 0;
var DATA_PRINTER_STATUS = 1 << 1;
var DATA_PRINTER_TYPES = 1 << 2;
var DATA_PRINTER_MEMBERS = 1 << 3;
var DATA_MEMBERS = 1 << 4;
var DATA_JOBS = 1 << 5;
var DATA_ALL = DATA_PRINTERS | DATA_PRINTER_STATUS | DATA_PRINTER_TYPES | DATA_PRINTER_MEMBERS | DATA_MEMBERS;

var Actions = Reflux.createActions({
    'registerPrinter': {asyncResult: true},
    'deletePrinter': {asyncResult: true},
    'resetPrinter': {asyncResult: true},
    'pauseJob': {asyncResult: true},
    'resumeJob': {asyncResult: true},
    'cancelJob': {asyncResult: true},
    'refresh': {}
});

var Store = Reflux.createStore({
    listenables: [Actions],

    init: function () {
        this.state = {
            printers: [],
            status: {},
            printerTypes: {},
            printerMembers: {},
            members: {},
            jobs: {}
        };

        // We send several different spark requests out. Wait until they've
        // returned before calling trigger().
        //
        this._dataWaiting = DATA_ALL;

        // Remember when a printer's status was last refreshed.
        //
        this._statusTimestamps = {};

        // Listen to the Login store to handle login/logout events.
        //
        this.listenTo(Login.Store, this._loginStoreChanged);

        // Regularly update printers and status.
        //
        var that = this;

        (function pollPrinters() {
            if (ADSKSpark.Client.isAccessTokenValid()) {
                that._getPrinters();
            }
            setTimeout(pollPrinters, REFRESH_PRINTER);
        }());

        (function pollStatus() {
            if (ADSKSpark.Client.isAccessTokenValid()) {
                that._getPrinterStatus();
            }
            setTimeout(pollStatus, 1000);
        }());
    },

    getInitialState: function () {
        return this.state;
    },

    /**
     * Login store change listener.
     * @param state
     * @private
     */
    _loginStoreChanged: function (state) {
        if (state.isLoggedIn) {
            this._getPrinters();
        } else {
            this._dataWaiting = DATA_ALL;
            this._statusTimestamps = {};
            this.state.printers = [];
            this.state.status = {};
            this.state.printerTypes = {};
            this.state.printerMembers = {};
            this.state.members = {};
            this.state.jobs = {};
            this.trigger(this.state);
        }
    },

    /**
     * Get all printers registered to the current member.
     * A convenience method that collects all of the state together.
     * @returns {Array} Printers and printer information.
     *
     * [
     *     {
     *         printer: ADSKSpark.Printer,
     *         printerType: {},
     *         owner: {},
     *         printerMembers: ADSKSpark.PrinterMembers,
     *         status: {},
     *         job: {} || undefined
     *     },
     * ]
     *
     * To lookup the owner, you might do something like this:
     * var that = this;
     * var printerData = PrintManager.Store.getPrinterData();
     * printerData.forEach(function (datum) {
     *     var owner = that.state.members[datum.owner.member_id];
     *     var ownerName = owner ? (owner.name + '\'s ') : '';
     *     console.log(ownerName + datum.printer.printer_name);
     *     console.log('printer_status=' + datum.status.last_reported_state.printer_status);
     * });
     */
    getPrinterData: function () {
        var that = this;
        var printers = this.state.printers.map(function (printer) {
            var printerId = printer.printer_id;

            // Find the printer owner.
            //
            var printerMembers = that.state.printerMembers[printerId];
            var owner = printerMembers ? utilities.find(printerMembers, function (member) {
                return member.is_registered && member.is_primary;
            }) : {member_id: null};

            // Find the printer status and make sure it has some expected sub-objects.
            // We use the cached printer status in this.state.status instead of the
            // status that's a part of each printer object - the latter gets reset
            // whenever the printers are refreshed.
            //
            var status = that.state.status[printerId] || {};
            if (!status.last_reported_state) {
                status.last_reported_state = {};
            }
            if (!status.last_reported_state.data) {
                status.last_reported_state.data = {};
            }

            return {
                printer: printer,
                printerType: that.state.printerTypes[printer.type_id],
                owner: owner,
                printerMembers: printerMembers,
                status: status,
                job: that.state.jobs[printerId]
            };
        });

        // Sort by printer name.
        // TODO: add ability to sort by different fields, add filtering.
        //
        printers.sort(function (a, b) {
            return a.printer.printer_name.toLowerCase().localeCompare(b.printer.printer_name.toLowerCase());
        });

        return printers;
    },

    /**
     * registerPrinter action listener.
     * Register a new printer to the current member.
     * @param {string} name - Printer nickname.
     * @param {string} code - Printer registration token.
     */
    onRegisterPrinter: function (name, code) {
        var that = this;
        return ADSKSpark.Printer.register(name, code)
            .then(function (data) {
                that._getPrinters();
                Actions.registerPrinter.completed(data);
            }).catch(function (error) {
                Actions.registerPrinter.failed(error);
            });
    },

    /**
     * deletePrinter action listener.
     * Delete the specified printer for the current member.
     * TODO: REST api fails if printer is shared.
     * @param {ADSKSpark.Printer} printer
     */
    onDeletePrinter: function (printer) {
        var that = this;
        printer.unregister()
            .then(function () {
                that._getPrinters();
                Actions.deletePrinter.completed();
            }).catch(function (error) {
                Actions.deletePrinter.failed(error);
            });
    },

    /**
     * resetPrinter action listener.
     * Send reset command to the specified printer.
     * @param {ADSKSpark.Printer} printer
     */
    onResetPrinter: function (printer) {
        var that = this;
        printer.reset()
            .then(function () {
                delete that._statusTimestamps[printer.printer_id];
                Actions.resetPrinter.completed();
            }).catch(function (error) {
                Actions.resetPrinter.failed(error);
            });
    },

    /**
     * pauseJob action listener.
     * Send pause job command to the specified printer for the active job.
     * @param {ADSKSpark.Printer} printer
     */
    onPauseJob: function (printer) {
        this._sendJobCommand(printer, 'pauseJob', 'pause');
    },

    /**
     * resumeJob action listener.
     * Send resume job command to the specified printer for the active job.
     * @param {ADSKSpark.Printer} printer
     */
    onResumeJob: function (printer) {
        this._sendJobCommand(printer, 'resumeJob', 'resume');
    },

    /**
     * cancelJob action listener.
     * Send cancel job command to the specified printer for the active job.
     * @param {ADSKSpark.Printer} printer
     */
    onCancelJob: function (printer) {
        this._sendJobCommand(printer, 'cancelJob', 'cancel');
    },

    /**
     * refresh action listener.
     */
    onRefresh: function () {
        if (ADSKSpark.Client.isAccessTokenValid()) {
            this._getPrinters();
        }
    },

    /**
     * Get the printers registered to the current member and
     * get the secondary information about those printers.
     * @private
     */
    _getPrinters: function () {
        var that = this;
        ADSKSpark.Printers.get({limit: -1})
            .then(function (printers) {
                that.state.printers = printers;
                that._trigger(DATA_PRINTERS);
                that._getPrinterStatus(true);
                that._getPrinterTypes();
                that._getPrinterMembers();
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    },

    /**
     * Get the printer status for the printers registered to the current member.
     * This may get the status for all printers, or it may take into account how long it's
     * been since the status for a printer was retrieved and the status of the printer.
     * @param {boolean} force - If true then update all printers.
     * @private
     */
    _getPrinterStatus: function (force) {
        if (!this.state.printers.length) {
            return;
        }

        var updated = false;
        var now = Date.now();
        var printers;

        // Build a list of the printers we want to update. This might be all of them,
        // or it might be a subset - we update printing/paused printers more often.
        //
        if (force) {
            printers = this.state.printers;
        } else {
            printers = [];
            for (var i = 0, length = this.state.printers.length; i < length; ++i) {
                var printer = this.state.printers[i];
                var printerId = printer.printer_id;

                var timestamp = this._statusTimestamps[printerId] || 0;
                var delta = now - timestamp;

                var status = this.state.status[printerId];
                var state = status ? status.last_reported_state : null;
                var printerStatus = state ? state.printer_status : null;
                var isActive = (printerStatus === 'printing' || printerStatus === 'paused');
                var isPrinting = (printerStatus === 'printing');

                if ((isActive && REFRESH_STATUS_PRINTING < delta) || (REFRESH_STATUS_NOT_PRINTING < delta)) {
                    printers.push(printer);

                } else if (isPrinting) {

                    // TODO: experimental, see how this feels in practice
                    // One problem I can see: if the printer firmware is sending updates at
                    // a lower frequency than we poll them, then this time remaining can
                    // jump back up.
                    //
                    if (state) {
                        var data = state.data;
                        if (data) {
                            var remaining = data.seconds_left;
                            if (remaining && 0 < remaining) {
                                state.data.seconds_left = --remaining;
                                updated = true;
                            }
                        }
                    }
                }
            }
        }

        // Retrieve the status.
        //
        if (printers.length) {
            var that = this;
            Promise.all(printers.map(function (printer) {
                return printer.getStatus();
            })).then(function () {
                if (force) {
                    that._statusTimestamps = {};
                    that.state.status = {};
                }

                var now = Date.now();
                printers.forEach(function (printer) {
                    var printerId = printer.printer_id;
                    that._statusTimestamps[printerId] = now;
                    that.state.status[printerId] = printer.status;
                });
                that._trigger(DATA_PRINTER_STATUS);
                that._getJobs();
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
        } else if (updated) {
            this._trigger(DATA_PRINTER_STATUS);
        }
    },

    /**
     * Get the printer types for the printers registered to the current member.
     * @private
     */
    _getPrinterTypes: function () {
        if (!this.state.printers.length) {
            return;
        }

        // Which printer types are represented?
        //
        var printerTypeIds = {};
        this.state.printers.forEach(function (printer) {
            printerTypeIds[printer.type_id] = true;
        });

        // Don't bother with printer types we've seen before.
        //
        for (var printerTypeId in printerTypeIds) {
            if (printerTypeIds.hasOwnProperty(printerTypeId)) {
                if (this.state.printerTypes.hasOwnProperty(printerTypeId)) {
                    delete printerTypeIds[printerTypeId];
                }
            }
        }

        // Retrieve the printer types.
        //
        printerTypeIds = Object.keys(printerTypeIds);
        if (printerTypeIds.length) {
            var that = this;
            Promise.all(printerTypeIds.map(function (printerTypeId) {
                return ADSKSpark.PrintDB.getPrinterType(printerTypeId);
            })).then(function (printerTypes) {
                printerTypes.forEach(function (printerType) {
                    that.state.printerTypes[printerType.id] = printerType;
                });
                that._trigger(DATA_PRINTER_TYPES);
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
        }
    },

    /**
     * Get the printer members for the printers registered to the current member.
     * @private
     */
    _getPrinterMembers: function () {
        if (!this.state.printers.length) {
            return;
        }

        var that = this;
        Promise.all(this.state.printers.map(function (printer) {
            return printer.getMembers({limit: -1});
        })).then(function (printerMembers) {
            that.state.printerMembers = {};
            printerMembers.forEach(function (printerMember) {
                that.state.printerMembers[printerMember.data.printer_id] = printerMember;
            });
            that._trigger(DATA_PRINTER_MEMBERS);
            that._getMembers();
        }).catch(function (error) {
            Status.MessageAction.error('ERROR: ' + error.message);
        });
    },

    /**
     * Get the member information for the printer members.
     * @private
     */
    _getMembers: function () {
        if (!this.state.printers.length) {
            return;
        }

        // Which members are registered to the printers?
        //
        var memberIds = {};
        for (var printerId in this.state.printerMembers) {
            if (this.state.printerMembers.hasOwnProperty(printerId)) {
                var printerMembers = this.state.printerMembers[printerId];
                printerMembers.forEach(function (printerMember) {
                    memberIds[printerMember.member_id] = true;
                });
            }
        }

        // Don't bother with members we've seen before.
        //
        for (var memberId in memberIds) {
            if (memberIds.hasOwnProperty(memberId)) {
                if (this.state.members.hasOwnProperty(memberId)) {
                    delete memberIds[memberId];
                }
            }
        }

        // Retrieve the member information.
        //
        memberIds = Object.keys(memberIds);
        if (memberIds.length) {
            var that = this;
            Promise.all(memberIds.map(function (memberId) {
                return ADSKSpark.Members.getMemberProfile(memberId);
            })).then(function (members) {
                members.forEach(function (member) {
                    that.state.members[member.member.id] = member.member;
                });
                that._trigger(DATA_MEMBERS);
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
        }
    },

    /**
     * Get the active job information for all printers registered to the current member.
     * @private
     */
    _getJobs: function () {
        if (!this.state.printers.length) {
            return;
        }

        var that = this;

        // Build an array of active jobs.
        //
        var jobs = [];
        this.state.printers.forEach(function (printer) {
            var printerId = printer.printer_id;
            var status = that.state.status[printerId];
            if (status) {
                var state = status.last_reported_state;
                if (state) {
                    var jobId = state.job_id;
                    if (jobId !== undefined) {
                        jobs.push(new ADSKSpark.Job({
                            job_id: jobId,
                            printer_id: printerId
                        }));
                    }
                }
            }
        });

        // Retrieve job status.
        //
        if (jobs.length) {
            Promise.all(jobs.map(function (job) {
                return job.getStatus();
            })).then(function () {
                that.state.jobs = {};
                jobs.forEach(function (job) {
                    that.state.jobs[job.printer_id] = job.data;
                });
                that._trigger(DATA_JOBS);
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
        }
    },

    /**
     * Send a job command to the specified printer and wait for the printer status to change.
     * @param {ADSKSpark.Printer} printer
     * @param {string} action
     * @param {string} command
     * @private
     */
    _sendJobCommand: function (printer, action, command) {
        function getPrinterStatus(printer) {
            return ((printer.status || {}).last_reported_state || {}).printer_status;
        }

        function getJobId(printer) {
            return ((printer.status || {}).last_reported_state || {}).job_id;
        }

        var that = this;
        var timeout = 8;
        var initialPrinterStatus = getPrinterStatus(printer);
        var jobId = getJobId(printer);
        if (!jobId) {
            Actions[action].failed('No job');
        }

        printer[command](jobId)
            .then(function () {
                (function poll() {
                    printer.getStatus()
                        .then(function () {
                            var repeat = true;

                            if (initialPrinterStatus !== getPrinterStatus(printer)) {
                                var printerId = printer.printer_id;
                                that._statusTimestamps[printerId] = Date.now();
                                that.state.status[printerId] = printer.status;

                                Actions[action].completed();
                                that.trigger(that.state);

                                repeat = false;

                            } else if (timeout <= 0) {
                                Actions[action].failed(new Error('timeout'));
                                repeat = false;
                            }

                            if (repeat) {
                                timeout--;
                                setTimeout(poll, 1000);
                            }
                        }).catch(function (error) {
                            Actions[action].failed(error);
                        });
                }());

            }).catch(function (error) {
                Actions[action].failed(error);
            });
    },

    /**
     * Call trigger() when printer data has been received.
     * @param {number} data - DATA_* received.
     * @private
     */
    _trigger: function (data) {
        this._dataWaiting &= ~data;
        if (!this._dataWaiting) {
            this.trigger(this.state);
        }
    }
});

module.exports = {
    Actions: Actions,
    Store: Store
};
