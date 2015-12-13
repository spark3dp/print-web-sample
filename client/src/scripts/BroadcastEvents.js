'use strict';

var BROADCAST_EVENT_TYPE = 'BroadcastEvent';
var events = {};

module.exports = {
    events: events,

    listen: function () {
        var listener = function (event) {
            if (!window.location.origin) {
                window.location.origin = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
            }
            if (event.origin === window.location.origin &&
                event.data && event.data.type === BROADCAST_EVENT_TYPE) {

                var callback = events[event.data.eventName];
                if (callback) {
                    callback(event.data.params);
                }
            }
        };

        if (window.addEventListener) {
            window.addEventListener('message', listener, false);
        } else {
            window.attachEvent('onmessage', listener);
        }
    },

    emit: function (eventName, params) {
        var data = {
            type: BROADCAST_EVENT_TYPE,
            eventName: eventName,
            params: params
        };
        parent.postMessage(data, '*');
    }
};
