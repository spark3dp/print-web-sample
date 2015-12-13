'use strict';

/**
 * Find an item matching a predicate in an array.
 * @param {Object[]} items - An array of items to search
 * @param {function(Object, number, Object[])} predicate - Function to execute on each item in the array
 * @param {Object} thisArg - Object to use as this when executing predicate
 * @returns {Object} First item in array that satisfies the predicate, else undefined
 */
function find(items, predicate, thisArg) {
    if (items && items.length) {
        for (var i = 0, length = items.length; i < length; ++i) {
            var item = items[i];
            if (predicate.call(thisArg, item, i, items)) {
                return item;
            }
        }
    }
    return undefined;
}

/**
 * Find the index of an item matching a predicate in an array.
 * @param {Object[]} items - An array of items to search
 * @param {function(Object, number, Object[])} predicate - Function to execute on each item in the array
 * @param {Object} thisArg - Object to use as this when executing predicate
 * @returns {Object} Index of first item in array that satisfies the predicate, else -1
 */
function findIndex(items, predicate, thisArg) {
    if (items && items.length) {
        for (var i = 0, length = items.length; i < length; ++i) {
            var item = items[i];
            if (predicate.call(thisArg, item, i, items)) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Returns true if two arrays are the same (shallow comparison) and false otherwise.
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function isEqualArray(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || (a.length !== b.length)) {
        return false;
    }

    for (var i = 0, length = a.length; i < length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

function formatTemp(t) {
    function asString(t, unit) {
        return t.toFixed() + '\u00B0' + unit;
    }

    if (typeof t === 'string') {
        t = parseInt(t, 10);
    }

    var c = asString(t, 'C');
    var f = asString((t * 1.8) + 32, 'F');
    return c + '/' + f;
}

function formatLayers(current, total) {
    var percent = (0 < total) ? ((current / total) * 100).toFixed() : 100;
    return 'Layer ' + current + '/' + total + ' (' + percent + '%)';
}

function formatTime(t) {
    if (typeof t === 'string') {
        t = parseInt(t, 10);
    }
    return 'Time remaining: ' + moment.duration(t, 's').format('d[d] h:mm:ss');
}

function formatJob(job) {
    return {
        temp: formatTemp(job.temp),
        progress: formatLayers(job.current, job.total),
        remaining: formatTime(job.remaining)
    };
}

module.exports = {
    find: find,
    findIndex: findIndex,
    isEqualArray: isEqualArray,
    formatJob: formatJob
};
