(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* JSHint inline */ 
/* jshint node: true */ 

'use strict';

var ERRORS ={
    'unsupport': 'qbMediaRecorder is not supported this environment.',
    'unsupportMediaRecorderWithOptions': 'Got a warning when creating a MediaRecorder, trying to create MediaRecorder without options.',
    'callbackError': 'Founded an error in callback:',
    'actionFailed': 'qbMediaRecorder is not created or has an invalid state.',
    'no_recorded_chunks': 'Does not have any recording data.', 
    'InvalidState': 'qbMediaRecorder is not in a state in which the proposed operation is allowed to be executed.',
    'OutOfMemory': 'The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'IllegalStreamModification': 'A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'OtherRecordingError': 'Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested'
};

module.exports = ERRORS;
},{}],2:[function(require,module,exports){
/* JSHint inline rules */
/* jshint node: true, browser: true */ 

'use strict';

var ERRORS = require('./errors');

/**  
 * @constructor qbMediaRecorder
 * @param  {mediaStream} stream object representing a flux of audio- or video-related data.
 * @param  {object} opts        see example
 *
 * @example
 * opts = {
 *     mimeType: 'audio',       // set mime type of record media or only type of media: 'video'/'audio'.
 *     ignoreMutedMedia: false, // What to do with a muted input MediaStreamTrack,
 *                              // e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 *                              // By default is `true`.
 *     timeSlice: 1000,         // optionally be passed a timeslice argument with a value in milliseconds.
 *                              // the media will be captured in separate chunks of that duration,
 *                              // rather than the default behavior of recording the media in a single large chunk.
 *     callbacks: {             // Note! Use named function for better debug.
 *         onStart: function startRecord() {
 *             //...
 *         },
 *         onError: function errorRecord(error) {
 *             //...
 *         },
 *         onPause: function pauseRecord() {
 *             //...
 *         },
 *         onStop: function stopRecord(blob) {
 *             //...
 *         },
 *         onResume: function resimeRecord() {
 *             //...
 *         }
 *     }
 * }
 */
function qbMediaRecorder(stream, opts) {
    var self = this;

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    self._stream = null;
    
    self._mediaRecorder = null;
    self._recordedChunks = [];

    self._timeSlice = opts && opts.timeSlice ? opts.timeSlice : 1000;
    self._userCallbacks = opts && opts.callbacks ? opts.callbacks : null; 

    var typeMediaRecorded = 'video', // by default
        prefferedMimeType = opts && opts.mimeType;

    if(prefferedMimeType) {
        typeMediaRecorded = prefferedMimeType.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
    }

    self._options = {
        mimeType: qbMediaRecorder.getSupportedMimeTypes(typeMediaRecorded, prefferedMimeType)[0],
        ignoreMutedMedia: opts && typeof opts.ignoreMutedMedia !== undefined ? opts.ignoreMutedMedia : true
    };
}

/**
 * Checking is environment supports recording.
 * @return {Boolean} Returns true if the qbMediaRecorder is available and can run, or false otherwise.
 */
qbMediaRecorder.isAvailable = function(){
    return !!(window && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function');
};

/**
 * @access private
 * 
 * All available mime types in browser environment.
 * @type {Object}
 */
qbMediaRecorder._mimeTypes = {
    'audio': [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg'
    ],
    'video': [
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=daala',
        'video/webm',
        'video/mp4',
        'video/mpeg'
    ]
};

/**
 * Checking all mime types for support in browser enviroment. Recommended mime type has 0 index.
 * 
 * @param  {string} prefferedTypeMedia 'audio' or 'video'. What type of media you want to check support.
 *                                     By default is 'video'.
 * @return {array}                     Array of supported mimetypes.
 */
qbMediaRecorder.getSupportedMimeTypes = function(prefferedTypeMedia) {
    var self = this,
        supportedMimeType = [],
        typeMedia = prefferedTypeMedia || 'video';

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return qbMediaRecorder._mimeTypes[typeMedia].filter(function(mimeType) {
        return window.MediaRecorder.isTypeSupported(mimeType);
    });
};

qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder.state;
};

/**
 * Start to recording a stream.
 * Fire the method `stop` if record has state `inprogress`.
 */
qbMediaRecorder.prototype.start = function() {
    var self = this;

    function fireCallback(name, args) {
        if(self._userCallbacks && typeof self._userCallbacks[name] === 'function') {
            try {
                self._userCallbacks[name](args);
            } catch(e) {
                console.error('Founded an error in callback:' + name, e);
            }
        }
    }

    /* Clear data from previously recording */ 
    self._mediaRecorder = null;
    self._recordedChunks.length = 0;

    try {
        self._mediaRecorder = new window.MediaRecorder(self._stream, self._options);
    } catch(e) {
        console.info(ERRORS.unsupportMediaRecorderWithOptions, e);

        self._mediaRecorder = new window.MediaRecorder(self._stream);
    }

    self._mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
           self._recordedChunks.push(e.data);
        }
    };

    self._mediaRecorder.onpause = function() {
        fireCallback('onPause');
    };

    self._mediaRecorder.onresume = function() {
        fireCallback('onResume');
    };

    self._mediaRecorder.onerror = function(error) {
        switch(error.name) {
            case 'InvalidState':
                console.error(ERRORS[error.name]);
                break;

            case 'OutOfMemory':
                console.error(ERRORS[error.name]);
                break;

            case 'IllegalStreamModification':
                console.error(ERRORS[error.name]);
                break;

            case 'OtherRecordingError':
                console.error(ERRORS[error.name]);
                break;

            case 'GenericError':
                console.error(ERRORS[error.name]);
                break;

            default:
                console.error('MediaRecorder Error', error);
                break;
        }

        if(self._mediaRecorder.state !== 'inactive' && self._mediaRecorder.state !== 'stopped') {
            self._mediaRecorder.stop();
        }

        if(self._userCallbacks && typeof self._userCallbacks.onErrorRecording === 'function') {
            fireCallback('onError', error);
        }
    };

    self._mediaRecorder.onstop = function(e) {
        var blob = new Blob(self._recordedChunks, {
            'type' : self._options.mimeType
        });

        fireCallback('onStop', blob);
    };

    self._mediaRecorder.start(self._timeSlice);

    fireCallback('onStart');
};

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
qbMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder.state;

    if(mediaRecorder && mediaRecorderState === 'recording'){
        mediaRecorder.stop();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Pause to recording a stream.
 */
qbMediaRecorder.prototype.pause = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'recording') {
        self._mediaRecorder.pause();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Resume to recording a stream.
 */
qbMediaRecorder.prototype.resume = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
        self._mediaRecorder.resume();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Return a [state of recording](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/state).
 * Possibly, inactive / paused / recording 
 * @return {String} A state of recording. 
 */
qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder.state;
};

/**
 * Create a file from blob and download as the file. Its method will fire 'stop' if recording in progress.
 * @param  {Strint} fileName Name of file. You can set `false` and we are generate name of file based on Date.now()
 * @param  {Blob}   blob     You can set blob which you get from the method `stop` or don't set anything and
 *                           we will get recorded chuncks.
 */
qbMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder.state;

    if(mediaRecorder && mediaRecorderState === 'recording') {
        mediaRecorder.stop();
    }

    var url = URL.createObjectURL(blob || self._getBlobRecorded()),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (fileName || Date.now()) + '.' + self._getExtension();

    document.body.appendChild(a);

    /* Start dowloading */
    a.click();
    
    /* Remove link */
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

/**
 * Create a Blob from recorded chunks.
 * @access private
 * @return {Blob}
 */
qbMediaRecorder.prototype._getBlobRecorded = function(data) {
    var self = this,
        chunks = data || self._recordedChunks;

    if(!chunks.length) {
        console.warn(ERRORS.no_recorded_chunks);
        return false;
    }

    return new Blob(chunks, { 'type' : self._options.mimeType });
};

/**
 * Return a extension of a file. Based on avaible mimeType.
 * @access private
 * @return {String} For example, 'webm' / 'mp4' / 'ogg'
 */
qbMediaRecorder.prototype._getExtension = function() {
    var self = this;

    var endTypeMedia = self._options.mimeType.indexOf('/'),
        extension = self._options.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};



module.exports = qbMediaRecorder;

},{"./errors":1}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogSlNIaW50IGlubGluZSAqLyBcclxuLyoganNoaW50IG5vZGU6IHRydWUgKi8gXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRVJST1JTID17XHJcbiAgICAndW5zdXBwb3J0JzogJ3FiTWVkaWFSZWNvcmRlciBpcyBub3Qgc3VwcG9ydGVkIHRoaXMgZW52aXJvbm1lbnQuJyxcclxuICAgICd1bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMnOiAnR290IGEgd2FybmluZyB3aGVuIGNyZWF0aW5nIGEgTWVkaWFSZWNvcmRlciwgdHJ5aW5nIHRvIGNyZWF0ZSBNZWRpYVJlY29yZGVyIHdpdGhvdXQgb3B0aW9ucy4nLFxyXG4gICAgJ2NhbGxiYWNrRXJyb3InOiAnRm91bmRlZCBhbiBlcnJvciBpbiBjYWxsYmFjazonLFxyXG4gICAgJ2FjdGlvbkZhaWxlZCc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IGNyZWF0ZWQgb3IgaGFzIGFuIGludmFsaWQgc3RhdGUuJyxcclxuICAgICdub19yZWNvcmRlZF9jaHVua3MnOiAnRG9lcyBub3QgaGF2ZSBhbnkgcmVjb3JkaW5nIGRhdGEuJywgXHJcbiAgICAnSW52YWxpZFN0YXRlJzogJ3FiTWVkaWFSZWNvcmRlciBpcyBub3QgaW4gYSBzdGF0ZSBpbiB3aGljaCB0aGUgcHJvcG9zZWQgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG8gYmUgZXhlY3V0ZWQuJyxcclxuICAgICdPdXRPZk1lbW9yeSc6ICdUaGUgVUEgaGFzIGV4aGF1c2VkIHRoZSBhdmFpbGFibGUgbWVtb3J5LiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6ICdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdPdGhlclJlY29yZGluZ0Vycm9yJzogJ1VzZWQgZm9yIGFuIGZhdGFsIGVycm9yIG90aGVyIHRoYW4gdGhvc2UgbGlzdGVkIGFib3ZlLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnR2VuZXJpY0Vycm9yJzogJ1RoZSBVQSBjYW5ub3QgcHJvdmlkZSB0aGUgY29kZWMgb3IgcmVjb3JkaW5nIG9wdGlvbiB0aGF0IGhhcyBiZWVuIHJlcXVlc3RlZCdcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRVJST1JTOyIsIi8qIEpTSGludCBpbmxpbmUgcnVsZXMgKi9cclxuLyoganNoaW50IG5vZGU6IHRydWUsIGJyb3dzZXI6IHRydWUgKi8gXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRVJST1JTID0gcmVxdWlyZSgnLi9lcnJvcnMnKTtcclxuXHJcbi8qKiAgXHJcbiAqIEBjb25zdHJ1Y3RvciBxYk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtICB7bWVkaWFTdHJlYW19IHN0cmVhbSBvYmplY3QgcmVwcmVzZW50aW5nIGEgZmx1eCBvZiBhdWRpby0gb3IgdmlkZW8tcmVsYXRlZCBkYXRhLlxyXG4gKiBAcGFyYW0gIHtvYmplY3R9IG9wdHMgICAgICAgIHNlZSBleGFtcGxlXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIG9wdHMgPSB7XHJcbiAqICAgICBtaW1lVHlwZTogJ2F1ZGlvJywgICAgICAgLy8gc2V0IG1pbWUgdHlwZSBvZiByZWNvcmQgbWVkaWEgb3Igb25seSB0eXBlIG9mIG1lZGlhOiAndmlkZW8nLydhdWRpbycuXHJcbiAqICAgICBpZ25vcmVNdXRlZE1lZGlhOiBmYWxzZSwgLy8gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjayxcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlLmcuIGluc2VydCBibGFjayBmcmFtZXMvemVybyBhdWRpbyB2b2x1bWUgaW4gdGhlIHJlY29yZGluZyBvciBpZ25vcmUgYWx0b2dldGhlci5cclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCeSBkZWZhdWx0IGlzIGB0cnVlYC5cclxuICogICAgIHRpbWVTbGljZTogMTAwMCwgICAgICAgICAvLyBvcHRpb25hbGx5IGJlIHBhc3NlZCBhIHRpbWVzbGljZSBhcmd1bWVudCB3aXRoIGEgdmFsdWUgaW4gbWlsbGlzZWNvbmRzLlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBtZWRpYSB3aWxsIGJlIGNhcHR1cmVkIGluIHNlcGFyYXRlIGNodW5rcyBvZiB0aGF0IGR1cmF0aW9uLFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJhdGhlciB0aGFuIHRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIHJlY29yZGluZyB0aGUgbWVkaWEgaW4gYSBzaW5nbGUgbGFyZ2UgY2h1bmsuXHJcbiAqICAgICBjYWxsYmFja3M6IHsgICAgICAgICAgICAgLy8gTm90ZSEgVXNlIG5hbWVkIGZ1bmN0aW9uIGZvciBiZXR0ZXIgZGVidWcuXHJcbiAqICAgICAgICAgb25TdGFydDogZnVuY3Rpb24gc3RhcnRSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvbkVycm9yOiBmdW5jdGlvbiBlcnJvclJlY29yZChlcnJvcikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25QYXVzZTogZnVuY3Rpb24gcGF1c2VSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvblN0b3A6IGZ1bmN0aW9uIHN0b3BSZWNvcmQoYmxvYikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25SZXN1bWU6IGZ1bmN0aW9uIHJlc2ltZVJlY29yZCgpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICovXHJcbmZ1bmN0aW9uIHFiTWVkaWFSZWNvcmRlcihzdHJlYW0sIG9wdHMpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gbnVsbDtcclxuICAgIFxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcyA9IFtdO1xyXG5cclxuICAgIHNlbGYuX3RpbWVTbGljZSA9IG9wdHMgJiYgb3B0cy50aW1lU2xpY2UgPyBvcHRzLnRpbWVTbGljZSA6IDEwMDA7XHJcbiAgICBzZWxmLl91c2VyQ2FsbGJhY2tzID0gb3B0cyAmJiBvcHRzLmNhbGxiYWNrcyA/IG9wdHMuY2FsbGJhY2tzIDogbnVsbDsgXHJcblxyXG4gICAgdmFyIHR5cGVNZWRpYVJlY29yZGVkID0gJ3ZpZGVvJywgLy8gYnkgZGVmYXVsdFxyXG4gICAgICAgIHByZWZmZXJlZE1pbWVUeXBlID0gb3B0cyAmJiBvcHRzLm1pbWVUeXBlO1xyXG5cclxuICAgIGlmKHByZWZmZXJlZE1pbWVUeXBlKSB7XHJcbiAgICAgICAgdHlwZU1lZGlhUmVjb3JkZWQgPSBwcmVmZmVyZWRNaW1lVHlwZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9vcHRpb25zID0ge1xyXG4gICAgICAgIG1pbWVUeXBlOiBxYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGVNZWRpYVJlY29yZGVkLCBwcmVmZmVyZWRNaW1lVHlwZSlbMF0sXHJcbiAgICAgICAgaWdub3JlTXV0ZWRNZWRpYTogb3B0cyAmJiB0eXBlb2Ygb3B0cy5pZ25vcmVNdXRlZE1lZGlhICE9PSB1bmRlZmluZWQgPyBvcHRzLmlnbm9yZU11dGVkTWVkaWEgOiB0cnVlXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2tpbmcgaXMgZW52aXJvbm1lbnQgc3VwcG9ydHMgcmVjb3JkaW5nLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHFiTWVkaWFSZWNvcmRlciBpcyBhdmFpbGFibGUgYW5kIGNhbiBydW4sIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyICYmIHR5cGVvZiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPT09ICdmdW5jdGlvbicpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBcclxuICogQWxsIGF2YWlsYWJsZSBtaW1lIHR5cGVzIGluIGJyb3dzZXIgZW52aXJvbm1lbnQuXHJcbiAqIEB0eXBlIHtPYmplY3R9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlcyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtJyxcclxuICAgICAgICAndmlkZW8vbXA0JyxcclxuICAgICAgICAndmlkZW8vbXBlZydcclxuICAgIF1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja2luZyBhbGwgbWltZSB0eXBlcyBmb3Igc3VwcG9ydCBpbiBicm93c2VyIGVudmlyb21lbnQuIFJlY29tbWVuZGVkIG1pbWUgdHlwZSBoYXMgMCBpbmRleC5cclxuICogXHJcbiAqIEBwYXJhbSAge3N0cmluZ30gcHJlZmZlcmVkVHlwZU1lZGlhICdhdWRpbycgb3IgJ3ZpZGVvJy4gV2hhdCB0eXBlIG9mIG1lZGlhIHlvdSB3YW50IHRvIGNoZWNrIHN1cHBvcnQuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5IGRlZmF1bHQgaXMgJ3ZpZGVvJy5cclxuICogQHJldHVybiB7YXJyYXl9ICAgICAgICAgICAgICAgICAgICAgQXJyYXkgb2Ygc3VwcG9ydGVkIG1pbWV0eXBlcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMgPSBmdW5jdGlvbihwcmVmZmVyZWRUeXBlTWVkaWEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBzdXBwb3J0ZWRNaW1lVHlwZSA9IFtdLFxyXG4gICAgICAgIHR5cGVNZWRpYSA9IHByZWZmZXJlZFR5cGVNZWRpYSB8fCAndmlkZW8nO1xyXG5cclxuICAgIGlmKCFxYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcWJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXNbdHlwZU1lZGlhXS5maWx0ZXIoZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgICAgICByZXR1cm4gd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX21lZGlhUmVjb3JkZXIuc3RhdGU7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RhcnQgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBGaXJlIHRoZSBtZXRob2QgYHN0b3BgIGlmIHJlY29yZCBoYXMgc3RhdGUgYGlucHJvZ3Jlc3NgLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpcmVDYWxsYmFjayhuYW1lLCBhcmdzKSB7XHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXShhcmdzKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicgKyBuYW1lLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKiBDbGVhciBkYXRhIGZyb20gcHJldmlvdXNseSByZWNvcmRpbmcgKi8gXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLmxlbmd0aCA9IDA7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSwgc2VsZi5fb3B0aW9ucyk7XHJcbiAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICBjb25zb2xlLmluZm8oRVJST1JTLnVuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucywgZSk7XHJcblxyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtKTtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoZS5kYXRhICYmIGUuZGF0YS5zaXplID4gMCkge1xyXG4gICAgICAgICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLnB1c2goZS5kYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25QYXVzZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvblJlc3VtZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgIHN3aXRjaChlcnJvci5uYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ0ludmFsaWRTdGF0ZSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ091dE9mTWVtb3J5JzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ090aGVyUmVjb3JkaW5nRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdHZW5lcmljRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTWVkaWFSZWNvcmRlciBFcnJvcicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJyAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnc3RvcHBlZCcpIHtcclxuICAgICAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbkVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihzZWxmLl9yZWNvcmRlZENodW5rcywge1xyXG4gICAgICAgICAgICAndHlwZScgOiBzZWxmLl9vcHRpb25zLm1pbWVUeXBlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25TdG9wJywgYmxvYik7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhcnQoc2VsZi5fdGltZVNsaWNlKTtcclxuXHJcbiAgICBmaXJlQ2FsbGJhY2soJ29uU3RhcnQnKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9wIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybiB7QmxvYn0gQmxvYiBvZiByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlciA9IHRoaXMuX21lZGlhUmVjb3JkZXIsXHJcbiAgICAgICAgbWVkaWFSZWNvcmRlclN0YXRlID0gbWVkaWFSZWNvcmRlci5zdGF0ZTtcclxuXHJcbiAgICBpZihtZWRpYVJlY29yZGVyICYmIG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3JlY29yZGluZycpe1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUGF1c2UgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXN1bWUgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdwYXVzZWQnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5yZXN1bWUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhIFtzdGF0ZSBvZiByZWNvcmRpbmddKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9NZWRpYVJlY29yZGVyL3N0YXRlKS5cclxuICogUG9zc2libHksIGluYWN0aXZlIC8gcGF1c2VkIC8gcmVjb3JkaW5nIFxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IEEgc3RhdGUgb2YgcmVjb3JkaW5nLiBcclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZWRpYVJlY29yZGVyLnN0YXRlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIGZpbGUgZnJvbSBibG9iIGFuZCBkb3dubG9hZCBhcyB0aGUgZmlsZS4gSXRzIG1ldGhvZCB3aWxsIGZpcmUgJ3N0b3AnIGlmIHJlY29yZGluZyBpbiBwcm9ncmVzcy5cclxuICogQHBhcmFtICB7U3RyaW50fSBmaWxlTmFtZSBOYW1lIG9mIGZpbGUuIFlvdSBjYW4gc2V0IGBmYWxzZWAgYW5kIHdlIGFyZSBnZW5lcmF0ZSBuYW1lIG9mIGZpbGUgYmFzZWQgb24gRGF0ZS5ub3coKVxyXG4gKiBAcGFyYW0gIHtCbG9ifSAgIGJsb2IgICAgIFlvdSBjYW4gc2V0IGJsb2Igd2hpY2ggeW91IGdldCBmcm9tIHRoZSBtZXRob2QgYHN0b3BgIG9yIGRvbid0IHNldCBhbnl0aGluZyBhbmRcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICB3ZSB3aWxsIGdldCByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5kb3dubG9hZCA9IGZ1bmN0aW9uKGZpbGVOYW1lLCBibG9iKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIuc3RhdGU7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiB8fCBzZWxmLl9nZXRCbG9iUmVjb3JkZWQoKSksXHJcbiAgICAgICAgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuXHJcbiAgICBhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICBhLmRvd25sb2FkID0gKGZpbGVOYW1lIHx8IERhdGUubm93KCkpICsgJy4nICsgc2VsZi5fZ2V0RXh0ZW5zaW9uKCk7XHJcblxyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcclxuXHJcbiAgICAvKiBTdGFydCBkb3dsb2FkaW5nICovXHJcbiAgICBhLmNsaWNrKCk7XHJcbiAgICBcclxuICAgIC8qIFJlbW92ZSBsaW5rICovXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XHJcbiAgICAgICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgIH0sIDEwMCk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgQmxvYiBmcm9tIHJlY29yZGVkIGNodW5rcy5cclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIEByZXR1cm4ge0Jsb2J9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRCbG9iUmVjb3JkZWQgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgY2h1bmtzID0gZGF0YSB8fCBzZWxmLl9yZWNvcmRlZENodW5rcztcclxuXHJcbiAgICBpZighY2h1bmtzLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMubm9fcmVjb3JkZWRfY2h1bmtzKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5ldyBCbG9iKGNodW5rcywgeyAndHlwZScgOiBzZWxmLl9vcHRpb25zLm1pbWVUeXBlIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhIGV4dGVuc2lvbiBvZiBhIGZpbGUuIEJhc2VkIG9uIGF2YWlibGUgbWltZVR5cGUuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IEZvciBleGFtcGxlLCAnd2VibScgLyAnbXA0JyAvICdvZ2cnXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRFeHRlbnNpb24gPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgZW5kVHlwZU1lZGlhID0gc2VsZi5fb3B0aW9ucy5taW1lVHlwZS5pbmRleE9mKCcvJyksXHJcbiAgICAgICAgZXh0ZW5zaW9uID0gc2VsZi5fb3B0aW9ucy5taW1lVHlwZS5zdWJzdHJpbmcoZW5kVHlwZU1lZGlhICsgMSksXHJcbiAgICAgICAgc3RhcnRDb2RlY3NJbmZvID0gZXh0ZW5zaW9uLmluZGV4T2YoJzsnKTtcclxuXHJcbiAgICBpZihzdGFydENvZGVjc0luZm8gIT09IC0xKSB7XHJcbiAgICAgICAgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uLnN1YnN0cmluZygwLCBzdGFydENvZGVjc0luZm8pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBleHRlbnNpb247XHJcbn07XHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gcWJNZWRpYVJlY29yZGVyO1xyXG4iXX0=
