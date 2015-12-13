'use strict';

var Config = require('./config.js');
var Status = require('./SparkStatus.js');

// Initialize the ADSKSpark Javascript SDK.
//
var options = {
    isProduction: false,
    guestTokenUrl: (Config.AUTH_SERVER_URL_BASE + Config.GUEST_TOKEN_URL),
    accessTokenUrl: (Config.AUTH_SERVER_URL_BASE + Config.ACCESS_TOKEN_URL),
    refreshTokenUrl: (Config.AUTH_SERVER_URL_BASE + Config.REFRESH_TOKEN_URL)
};
ADSKSpark.Client.initialize(Config.APP_KEY, options);

// Reflux actions and store for login/logout.

var Actions = Reflux.createActions([
    'login',
    'logout'
]);

var Store = Reflux.createStore({
    listenables: Actions,

    init: function () {
        this.state = {
            isLoggedIn: false
        };

        // Use a timer to automatically refresh the access token
        // before it expires.
        //
        this._refreshTokenTimerId = null;

        // Is there a valid access token? If so, then we're already logged in.
        //
        var token = ADSKSpark.Client.getAccessTokenObject();
        if (token && token.access_token) {
            if (token.expires_at && Date.now() < token.expires_at) {
                this.state.isLoggedIn = true;
                this._scheduleRefreshToken();
            } else {
                this._refreshToken();
            }
        }
    },

    getInitialState: function () {
        return this.state;
    },

    /**
     * login action listener.
     * This should be called after ADSKSpark.Client.completeLogin().
     */
    onLogin: function () {
        this.state.isLoggedIn = true;
        this.trigger(this.state);
        this._scheduleRefreshToken();
    },

    /**
     * logout action listener.
     */
    onLogout: function () {
        ADSKSpark.Client.logout();
        this._cancelRefreshToken();

        this.state.isLoggedIn = false;
        this.trigger(this.state);
    },

    /**
     * Schedule a refresh token call before the current access token expires.
     * @private
     */
    _scheduleRefreshToken: function () {
        this._cancelRefreshToken();

        var token = ADSKSpark.Client.getAccessTokenObject();
        if (token && token.access_token && token.refresh_token_status) {
            var refreshIn = token.expires_at - Date.now() - (60 * 1000); // 1 min buffer
            if (0 < refreshIn) {
                var that = this;
                this._refreshTokenTimerId = setTimeout(function () {
                    that._refreshToken();
                }, refreshIn);

            } else {

                // Refresh right away.
                //
                this._refreshToken();
            }
        }
    },

    /**
     * Cancel any pending refresh token call.
     * @private
     */
    _cancelRefreshToken: function () {
        if (this._refreshTokenTimerId) {
            clearTimeout(this._refreshTokenTimerId);
            this._refreshTokenTimerId = null;
        }
    },

    /**
     * Refresh the access token.
     * @private
     */
    _refreshToken: function () {
        var that = this;
        ADSKSpark.Client.refreshAccessToken()
            .then(function (data) {
                if (data.Error) {
                    Status.MessageAction.error('ERROR: ' + data.Error);
                    that.onLogout();
                } else {
                    if (!that.state.isLoggedIn) {
                        that.state.isLoggedIn = true;
                        that.trigger(that.state);
                    }
                    that._scheduleRefreshToken();
                }
            }).catch(function (error) {
                Status.MessageAction.error('ERROR: ' + error.message);
                that.onLogout();
            });
    }
});

module.exports = {
    Actions: Actions,
    Store: Store
};
