'use strict';

var Login = require('./LoginStore.js');
var Status = require('./SparkStatus.js');

var Actions = Reflux.createActions([
    'refresh',
    'setRefreshInterval'
]);

var Store = Reflux.createStore({
    listenables: [Actions],

    init: function () {
        this.state = {
            jobs: []
        };

        this._refreshTimerId = null;

        this.listenTo(Login.Store, this._loginStoreChanged);
        if (Login.Store.state.isLoggedIn) {
            this._getJobs();
        }
    },

    getInitialState: function () {
        return this.state;
    },

    _loginStoreChanged: function (state) {
        if (state.isLoggedIn) {
            this._getJobs();
        } else {
            this.state.jobs = [];
            this.trigger(this.state);
        }
    },

    onRefresh: function () {
        this._getJobs();
    },

    onSetRefreshInterval: function (interval) {
        if (this._refreshTimerId) {
            clearInterval(this._refreshTimerId);
            this._refreshTimerId = null;
        }

        if (!interval || interval <= 0) {
            return;
        }

        if (interval < 10000) {
            interval = 10000;
        }

        this._getJobs();

        var that = this;
        this._refreshTimerId = setInterval(function () {
            if (Login.Store.state.isLoggedIn) {
                that._getJobs();
            }
        }, interval);
    },

    _getJobs: function () {
        var that = this;
        ADSKSpark.Jobs.get()
            .then(function (data) {
                that.state.jobs = data;
                that.trigger(that.state);
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    }
});

module.exports = {
    Actions: Actions,
    Store: Store
};
