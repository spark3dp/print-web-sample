'use strict';

var Login = require('./LoginStore.js');
var Status = require('./SparkStatus.js');

var Store = Reflux.createStore({
    init: function () {
        this.state = {
            member: null
        };

        this.listenTo(Login.Store, this._loginStoreChanged);
        if (Login.Store.state.isLoggedIn) {
            this._getMyProfile();
        }
    },

    getInitialState: function () {
        return this.state;
    },

    _loginStoreChanged: function (state) {
        if (state.isLoggedIn) {
            this._getMyProfile();
        } else {
            this.state.member = null;
            this.trigger(this.state);
        }
    },

    _getMyProfile: function () {
        var that = this;
        ADSKSpark.Members.getMyProfile()
            .then(function (data) {
                that.state.member = data.member;
                that.trigger(that.state);
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
            });
    }
});

module.exports = {
    Store: Store
};
