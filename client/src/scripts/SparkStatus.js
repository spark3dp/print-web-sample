'use strict';

var MessageActions = Reflux.createActions([
    'success',
    'error',
    'info'
]);

var MessageStore = Reflux.createStore({
    listenables: [MessageActions],

    onSuccess: function (message) {
        toastr.success(message);
    },

    onError: function (message) {
        toastr.error(message);
    },

    onInfo: function (message) {
        toastr.info(message);
    }
});

var ProgressActions = Reflux.createActions([
    'start',
    'progress'
]);

var ProgressStore = Reflux.createStore({
    listenables: [ProgressActions],

    state: {
        operation: null,
        progress: 0
    },

    onStart: function (operation) {
        this.state.operation = operation;
        this.state.progress = 0.0;
        this.trigger(this.state);
    },

    onProgress: function (operation, progress) {
        this.state.operation = operation;
        this.state.progress = progress;
        console.log('this.state.progress ' + this.state.operation + ': ' + this.state.progress);
        this.trigger(this.state);
    }
});

module.exports = {
    MessageAction: MessageActions,
    MessageStore: MessageStore,
    ProgressAction: ProgressActions,
    ProgressStore: ProgressStore
};
