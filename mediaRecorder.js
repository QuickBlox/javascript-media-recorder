(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* JSHint inline */ 
/* jshint node: true */ 

'use strict';

var ERRORS ={
    'unsupport': 'qbMediaRecorder isn\'t supports this env.',
    'unsupportMediaRecorderWithOptions': 'Got a warning when creating a MediaRecorder, trying create MediaRecorder without options.',
    'callbackError': 'Founded an error in callback:',
    'actionFailed': 'Recorder isn\'t created or has invalid state.',
    'InvalidState': 'The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.',
    'OutOfMemory': 'The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'IllegalStreamModification': 'A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'OtherRecordingError': 'Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.',
    'GenericError': 'The UA cannot provide the codec or recording option that has been requested'
};

module.exports = ERRORS;
},{}],2:[function(require,module,exports){
/* JSHint inline rules */
/* globals MediaRecorder */
/* jshint node: true, browser: true */ 

'use strict';

var ERRORS = require('./errors');

/**  
 * @constructor qbMediaRecorder
 * @param  {mediaStream} stream [description]
 * @param  {object} opts        see below
 *
 * @example
 * opts = {
 *     mimeType: 'audio', // set mimeType of record media or only type of media: 'video'/'audio'.
 *     ignoreMutedMedia: false, // What to do with a muted input MediaStreamTrack,
 *                              e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 *                              By default is `true`.
 *     _timeSlice: 1000,
 *     callbacks: { 
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

    self._stream = stream;
    self._mediaRecorder = null;
    self._recordedChunks = [];

    self._timeSlice = opts && opts.timeSlice ? opts.timeSlice : 1000;
    self._userCallbacks = opts && opts.callbacks ? opts.callbacks : null; 

    var typeMediaRecorded = 'video', // by default
        prefferedMimeType = opts && opts.mimeType;

    if(prefferedMimeType) {
        typeMediaRecorded = prefferedMimeType.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
    }

    /*
     * Prepare options for self._mediaRecorder
     */
    self._options = {
        mimeType: qbMediaRecorder.getSupportedMimeTypes(typeMediaRecorded, prefferedMimeType)[0],
        ignoreMutedMedia: opts && typeof opts.ignoreMutedMedia !== undefined ? opts.ignoreMutedMedia : true
    };
}

/**
 * Checking is env. supports recording.
 * @return {Boolean} A Boolean value that returns true if the qbMediaRecorder supports, or false otherwise.
 */
qbMediaRecorder.isAvailable = function(){
    return !!(window && window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function');
};

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
 * [getSupportedMimeType return array of supported mimetypes]
 * @param  {string} prefferedTypeMedia 'audio' or 'video'. what type of media you want to check support.
 *                                     By default is 'video'.
 * @return {array}                    array of supported mimetypes. Recomment mimetype has 0 index.
 */
qbMediaRecorder.getSupportedMimeTypes = function(prefferedTypeMedia) {
    var self = this,
        supportedMimeType = [],
        typeMedia = prefferedTypeMedia || 'video';

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return qbMediaRecorder._mimeTypes[typeMedia].filter(function(mimeType) {
        return MediaRecorder.isTypeSupported(mimeType);
    });
};

/**
 * Start to recording a stream.
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

    if (self._mediaRecorder) {
        self._mediaRecorder = null;
    }

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
        
    };

    self._mediaRecorder.onresume = function() {
        fireCallback('onPause');
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
            fireCallback('onError');
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
 * Stop to recording a stream
 * @return {Blob} Blob of recorded chuncks
 */
qbMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder.state;

    if(mediaRecorder && mediaRecorderState !== 'inactive' && mediaRecorderState !== 'stopped'){
        mediaRecorder.stop();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Pause to recording a stream
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
 * Resume to recording a stream
 */
qbMediaRecorder.prototype.resume = function() {
    var self = this;

    if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
        self._mediaRecorder.resume();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

qbMediaRecorder.prototype.getExtension = function() {
    var self = this;

    var endTypeMedia = self._options.mimeType.indexOf('/'),
        extension = self._options.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};

qbMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var url = URL.createObjectURL(blob || self._recordedBlobs),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (fileName || Date.now()) + '.' + self.getExtension();

    document.body.appendChild(a);

    /* Start dowloading */
    a.click();
    
    /* Remove link */
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
};

module.exports = qbMediaRecorder;

},{"./errors":1}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIEpTSGludCBpbmxpbmUgKi8gXHJcbi8qIGpzaGludCBub2RlOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9e1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdxYk1lZGlhUmVjb3JkZXIgaXNuXFwndCBzdXBwb3J0cyB0aGlzIGVudi4nLFxyXG4gICAgJ3Vuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucyc6ICdHb3QgYSB3YXJuaW5nIHdoZW4gY3JlYXRpbmcgYSBNZWRpYVJlY29yZGVyLCB0cnlpbmcgY3JlYXRlIE1lZGlhUmVjb3JkZXIgd2l0aG91dCBvcHRpb25zLicsXHJcbiAgICAnY2FsbGJhY2tFcnJvcic6ICdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicsXHJcbiAgICAnYWN0aW9uRmFpbGVkJzogJ1JlY29yZGVyIGlzblxcJ3QgY3JlYXRlZCBvciBoYXMgaW52YWxpZCBzdGF0ZS4nLFxyXG4gICAgJ0ludmFsaWRTdGF0ZSc6ICdUaGUgTWVkaWFSZWNvcmRlciBpcyBub3QgaW4gYSBzdGF0ZSBpbiB3aGljaCB0aGUgcHJvcG9zZWQgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG8gYmUgZXhlY3V0ZWQuJyxcclxuICAgICdPdXRPZk1lbW9yeSc6ICdUaGUgVUEgaGFzIGV4aGF1c2VkIHRoZSBhdmFpbGFibGUgbWVtb3J5LiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6ICdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdPdGhlclJlY29yZGluZ0Vycm9yJzogJ1VzZWQgZm9yIGFuIGZhdGFsIGVycm9yIG90aGVyIHRoYW4gdGhvc2UgbGlzdGVkIGFib3ZlLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnR2VuZXJpY0Vycm9yJzogJ1RoZSBVQSBjYW5ub3QgcHJvdmlkZSB0aGUgY29kZWMgb3IgcmVjb3JkaW5nIG9wdGlvbiB0aGF0IGhhcyBiZWVuIHJlcXVlc3RlZCdcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRVJST1JTOyIsIi8qIEpTSGludCBpbmxpbmUgcnVsZXMgKi9cclxuLyogZ2xvYmFscyBNZWRpYVJlY29yZGVyICovXHJcbi8qIGpzaGludCBub2RlOiB0cnVlLCBicm93c2VyOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9IHJlcXVpcmUoJy4vZXJyb3JzJyk7XHJcblxyXG4vKiogIFxyXG4gKiBAY29uc3RydWN0b3IgcWJNZWRpYVJlY29yZGVyXHJcbiAqIEBwYXJhbSAge21lZGlhU3RyZWFtfSBzdHJlYW0gW2Rlc2NyaXB0aW9uXVxyXG4gKiBAcGFyYW0gIHtvYmplY3R9IG9wdHMgICAgICAgIHNlZSBiZWxvd1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBvcHRzID0ge1xyXG4gKiAgICAgbWltZVR5cGU6ICdhdWRpbycsIC8vIHNldCBtaW1lVHlwZSBvZiByZWNvcmQgbWVkaWEgb3Igb25seSB0eXBlIG9mIG1lZGlhOiAndmlkZW8nLydhdWRpbycuXHJcbiAqICAgICBpZ25vcmVNdXRlZE1lZGlhOiBmYWxzZSwgLy8gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjayxcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmcuIGluc2VydCBibGFjayBmcmFtZXMvemVybyBhdWRpbyB2b2x1bWUgaW4gdGhlIHJlY29yZGluZyBvciBpZ25vcmUgYWx0b2dldGhlci5cclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCeSBkZWZhdWx0IGlzIGB0cnVlYC5cclxuICogICAgIF90aW1lU2xpY2U6IDEwMDAsXHJcbiAqICAgICBjYWxsYmFja3M6IHsgXHJcbiAqICAgICAgICAgb25TdGFydDogZnVuY3Rpb24gc3RhcnRSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvbkVycm9yOiBmdW5jdGlvbiBlcnJvclJlY29yZChlcnJvcikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25QYXVzZTogZnVuY3Rpb24gcGF1c2VSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvblN0b3A6IGZ1bmN0aW9uIHN0b3BSZWNvcmQoYmxvYikge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25SZXN1bWU6IGZ1bmN0aW9uIHJlc2ltZVJlY29yZCgpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICovXHJcbmZ1bmN0aW9uIHFiTWVkaWFSZWNvcmRlcihzdHJlYW0sIG9wdHMpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcyA9IFtdO1xyXG5cclxuICAgIHNlbGYuX3RpbWVTbGljZSA9IG9wdHMgJiYgb3B0cy50aW1lU2xpY2UgPyBvcHRzLnRpbWVTbGljZSA6IDEwMDA7XHJcbiAgICBzZWxmLl91c2VyQ2FsbGJhY2tzID0gb3B0cyAmJiBvcHRzLmNhbGxiYWNrcyA/IG9wdHMuY2FsbGJhY2tzIDogbnVsbDsgXHJcblxyXG4gICAgdmFyIHR5cGVNZWRpYVJlY29yZGVkID0gJ3ZpZGVvJywgLy8gYnkgZGVmYXVsdFxyXG4gICAgICAgIHByZWZmZXJlZE1pbWVUeXBlID0gb3B0cyAmJiBvcHRzLm1pbWVUeXBlO1xyXG5cclxuICAgIGlmKHByZWZmZXJlZE1pbWVUeXBlKSB7XHJcbiAgICAgICAgdHlwZU1lZGlhUmVjb3JkZWQgPSBwcmVmZmVyZWRNaW1lVHlwZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgIH1cclxuXHJcbiAgICAvKlxyXG4gICAgICogUHJlcGFyZSBvcHRpb25zIGZvciBzZWxmLl9tZWRpYVJlY29yZGVyXHJcbiAgICAgKi9cclxuICAgIHNlbGYuX29wdGlvbnMgPSB7XHJcbiAgICAgICAgbWltZVR5cGU6IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZU1lZGlhUmVjb3JkZWQsIHByZWZmZXJlZE1pbWVUeXBlKVswXSxcclxuICAgICAgICBpZ25vcmVNdXRlZE1lZGlhOiBvcHRzICYmIHR5cGVvZiBvcHRzLmlnbm9yZU11dGVkTWVkaWEgIT09IHVuZGVmaW5lZCA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWVcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVja2luZyBpcyBlbnYuIHN1cHBvcnRzIHJlY29yZGluZy5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gQSBCb29sZWFuIHZhbHVlIHRoYXQgcmV0dXJucyB0cnVlIGlmIHRoZSBxYk1lZGlhUmVjb3JkZXIgc3VwcG9ydHMsIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyICYmIHR5cGVvZiBNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9PT0gJ2Z1bmN0aW9uJyk7XHJcbn07XHJcblxyXG5xYk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlcyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtJyxcclxuICAgICAgICAndmlkZW8vbXA0JyxcclxuICAgICAgICAndmlkZW8vbXBlZydcclxuICAgIF1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBbZ2V0U3VwcG9ydGVkTWltZVR5cGUgcmV0dXJuIGFycmF5IG9mIHN1cHBvcnRlZCBtaW1ldHlwZXNdXHJcbiAqIEBwYXJhbSAge3N0cmluZ30gcHJlZmZlcmVkVHlwZU1lZGlhICdhdWRpbycgb3IgJ3ZpZGVvJy4gd2hhdCB0eXBlIG9mIG1lZGlhIHlvdSB3YW50IHRvIGNoZWNrIHN1cHBvcnQuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5IGRlZmF1bHQgaXMgJ3ZpZGVvJy5cclxuICogQHJldHVybiB7YXJyYXl9ICAgICAgICAgICAgICAgICAgICBhcnJheSBvZiBzdXBwb3J0ZWQgbWltZXR5cGVzLiBSZWNvbW1lbnQgbWltZXR5cGUgaGFzIDAgaW5kZXguXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzID0gZnVuY3Rpb24ocHJlZmZlcmVkVHlwZU1lZGlhKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgc3VwcG9ydGVkTWltZVR5cGUgPSBbXSxcclxuICAgICAgICB0eXBlTWVkaWEgPSBwcmVmZmVyZWRUeXBlTWVkaWEgfHwgJ3ZpZGVvJztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHFiTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzW3R5cGVNZWRpYV0uZmlsdGVyKGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICAgICAgcmV0dXJuIE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBmaXJlQ2FsbGJhY2sobmFtZSwgYXJncykge1xyXG4gICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3NbbmFtZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3VzZXJDYWxsYmFja3NbbmFtZV0oYXJncyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRm91bmRlZCBhbiBlcnJvciBpbiBjYWxsYmFjazonICsgbmFtZSwgZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNlbGYuX21lZGlhUmVjb3JkZXIpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtLCBzZWxmLl9vcHRpb25zKTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGNvbnNvbGUuaW5mbyhFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zLCBlKTtcclxuXHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0pO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChlLmRhdGEgJiYgZS5kYXRhLnNpemUgPiAwKSB7XHJcbiAgICAgICAgICAgc2VsZi5fcmVjb3JkZWRDaHVua3MucHVzaChlLmRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgXHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29uUGF1c2UnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICBzd2l0Y2goZXJyb3IubmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdJbnZhbGlkU3RhdGUnOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdXRPZk1lbW9yeSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0lsbGVnYWxTdHJlYW1Nb2RpZmljYXRpb24nOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdGhlclJlY29yZGluZ0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnR2VuZXJpY0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ01lZGlhUmVjb3JkZXIgRXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ3N0b3BwZWQnKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vbkVycm9yUmVjb3JkaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25FcnJvcicpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihzZWxmLl9yZWNvcmRlZENodW5rcywge1xyXG4gICAgICAgICAgICAndHlwZScgOiBzZWxmLl9vcHRpb25zLm1pbWVUeXBlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25TdG9wJywgYmxvYik7XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhcnQoc2VsZi5fdGltZVNsaWNlKTtcclxuXHJcbiAgICBmaXJlQ2FsbGJhY2soJ29uU3RhcnQnKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9wIHRvIHJlY29yZGluZyBhIHN0cmVhbVxyXG4gKiBAcmV0dXJuIHtCbG9ifSBCbG9iIG9mIHJlY29yZGVkIGNodW5ja3NcclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIuc3RhdGU7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyU3RhdGUgIT09ICdpbmFjdGl2ZScgJiYgbWVkaWFSZWNvcmRlclN0YXRlICE9PSAnc3RvcHBlZCcpe1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUGF1c2UgdG8gcmVjb3JkaW5nIGEgc3RyZWFtXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucGF1c2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc3VtZSB0byByZWNvcmRpbmcgYSBzdHJlYW1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5kb3dubG9hZCA9IGZ1bmN0aW9uKGZpbGVOYW1lLCBibG9iKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiB8fCBzZWxmLl9yZWNvcmRlZEJsb2JzKSxcclxuICAgICAgICBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG5cclxuICAgIGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgIGEuaHJlZiA9IHVybDtcclxuICAgIGEuZG93bmxvYWQgPSAoZmlsZU5hbWUgfHwgRGF0ZS5ub3coKSkgKyAnLicgKyBzZWxmLmdldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLyogU3RhcnQgZG93bG9hZGluZyAqL1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgXHJcbiAgICAvKiBSZW1vdmUgbGluayAqL1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxYk1lZGlhUmVjb3JkZXI7XHJcbiJdfQ==
