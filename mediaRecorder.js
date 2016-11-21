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
    'streamRequired': 'MediaStream is required.',
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
 *
 * var rec = new qbMediaRecorder(stream, opts);
 *
 * rec.start()
 * // ...
 * rec.stop();
 */
function qbMediaRecorder(stream, opts) {
    var self = this;

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    if(!stream) {
        throw new Error(ERRORS.streamRequired);
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

/**
 * Return a [state of recording](https://w3c.github.io/mediacapture-record/MediaRecorder.html#idl-def-recordingstate).
 * Possibly states: **inactive**, **recording**, **paused**
 * @return {String} Name of a state.
 */
qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder ? this._mediaRecorder.state : 'inactive';
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

    var mediaRecorderState = self.getState();

    if(mediaRecorderState === 'recording' || mediaRecorderState === 'paused'){
        self._mediaRecorder.stop();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIEpTSGludCBpbmxpbmUgKi8gXHJcbi8qIGpzaGludCBub2RlOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9e1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFUlJPUlM7IiwiLyogSlNIaW50IGlubGluZSBydWxlcyAqL1xyXG4vKiBqc2hpbnQgbm9kZTogdHJ1ZSwgYnJvd3NlcjogdHJ1ZSAqLyBcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqICBcclxuICogQGNvbnN0cnVjdG9yIHFiTWVkaWFSZWNvcmRlclxyXG4gKiBAcGFyYW0gIHttZWRpYVN0cmVhbX0gc3RyZWFtIG9iamVjdCByZXByZXNlbnRpbmcgYSBmbHV4IG9mIGF1ZGlvLSBvciB2aWRlby1yZWxhdGVkIGRhdGEuXHJcbiAqIEBwYXJhbSAge29iamVjdH0gb3B0cyAgICAgICAgc2VlIGV4YW1wbGVcclxuICpcclxuICogQGV4YW1wbGVcclxuICogb3B0cyA9IHtcclxuICogICAgIG1pbWVUeXBlOiAnYXVkaW8nLCAgICAgICAvLyBzZXQgbWltZSB0eXBlIG9mIHJlY29yZCBtZWRpYSBvciBvbmx5IHR5cGUgb2YgbWVkaWE6ICd2aWRlbycvJ2F1ZGlvJy5cclxuICogICAgIGlnbm9yZU11dGVkTWVkaWE6IGZhbHNlLCAvLyBXaGF0IHRvIGRvIHdpdGggYSBtdXRlZCBpbnB1dCBNZWRpYVN0cmVhbVRyYWNrLFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGUuZy4gaW5zZXJ0IGJsYWNrIGZyYW1lcy96ZXJvIGF1ZGlvIHZvbHVtZSBpbiB0aGUgcmVjb3JkaW5nIG9yIGlnbm9yZSBhbHRvZ2V0aGVyLlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJ5IGRlZmF1bHQgaXMgYHRydWVgLlxyXG4gKiAgICAgdGltZVNsaWNlOiAxMDAwLCAgICAgICAgIC8vIG9wdGlvbmFsbHkgYmUgcGFzc2VkIGEgdGltZXNsaWNlIGFyZ3VtZW50IHdpdGggYSB2YWx1ZSBpbiBtaWxsaXNlY29uZHMuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIG1lZGlhIHdpbGwgYmUgY2FwdHVyZWQgaW4gc2VwYXJhdGUgY2h1bmtzIG9mIHRoYXQgZHVyYXRpb24sXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmF0aGVyIHRoYW4gdGhlIGRlZmF1bHQgYmVoYXZpb3Igb2YgcmVjb3JkaW5nIHRoZSBtZWRpYSBpbiBhIHNpbmdsZSBsYXJnZSBjaHVuay5cclxuICogICAgIGNhbGxiYWNrczogeyAgICAgICAgICAgICAvLyBOb3RlISBVc2UgbmFtZWQgZnVuY3Rpb24gZm9yIGJldHRlciBkZWJ1Zy5cclxuICogICAgICAgICBvblN0YXJ0OiBmdW5jdGlvbiBzdGFydFJlY29yZCgpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9LFxyXG4gKiAgICAgICAgIG9uRXJyb3I6IGZ1bmN0aW9uIGVycm9yUmVjb3JkKGVycm9yKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvblBhdXNlOiBmdW5jdGlvbiBwYXVzZVJlY29yZCgpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9LFxyXG4gKiAgICAgICAgIG9uU3RvcDogZnVuY3Rpb24gc3RvcFJlY29yZChibG9iKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfSxcclxuICogICAgICAgICBvblJlc3VtZTogZnVuY3Rpb24gcmVzaW1lUmVjb3JkKCkge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH1cclxuICogICAgIH1cclxuICogfVxyXG4gKlxyXG4gKiB2YXIgcmVjID0gbmV3IHFiTWVkaWFSZWNvcmRlcihzdHJlYW0sIG9wdHMpO1xyXG4gKlxyXG4gKiByZWMuc3RhcnQoKVxyXG4gKiAvLyAuLi5cclxuICogcmVjLnN0b3AoKTtcclxuICovXHJcbmZ1bmN0aW9uIHFiTWVkaWFSZWNvcmRlcihzdHJlYW0sIG9wdHMpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMuc3RyZWFtUmVxdWlyZWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3N0cmVhbSA9IHN0cmVhbTtcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cclxuICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzID0gW107XHJcblxyXG4gICAgc2VsZi5fdGltZVNsaWNlID0gb3B0cyAmJiBvcHRzLnRpbWVTbGljZSA/IG9wdHMudGltZVNsaWNlIDogMTAwMDtcclxuICAgIHNlbGYuX3VzZXJDYWxsYmFja3MgPSBvcHRzICYmIG9wdHMuY2FsbGJhY2tzID8gb3B0cy5jYWxsYmFja3MgOiBudWxsOyBcclxuXHJcbiAgICB2YXIgdHlwZU1lZGlhUmVjb3JkZWQgPSAndmlkZW8nLCAvLyBieSBkZWZhdWx0XHJcbiAgICAgICAgcHJlZmZlcmVkTWltZVR5cGUgPSBvcHRzICYmIG9wdHMubWltZVR5cGU7XHJcblxyXG4gICAgaWYocHJlZmZlcmVkTWltZVR5cGUpIHtcclxuICAgICAgICB0eXBlTWVkaWFSZWNvcmRlZCA9IHByZWZmZXJlZE1pbWVUeXBlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhdWRpbycpID09PSAtMSA/ICd2aWRlbycgOiAnYXVkaW8nO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX29wdGlvbnMgPSB7XHJcbiAgICAgICAgbWltZVR5cGU6IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZU1lZGlhUmVjb3JkZWQsIHByZWZmZXJlZE1pbWVUeXBlKVswXSxcclxuICAgICAgICBpZ25vcmVNdXRlZE1lZGlhOiBvcHRzICYmIHR5cGVvZiBvcHRzLmlnbm9yZU11dGVkTWVkaWEgIT09IHVuZGVmaW5lZCA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWVcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVja2luZyBpcyBlbnZpcm9ubWVudCBzdXBwb3J0cyByZWNvcmRpbmcuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgcWJNZWRpYVJlY29yZGVyIGlzIGF2YWlsYWJsZSBhbmQgY2FuIHJ1biwgb3IgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24oKXtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgd2luZG93Lk1lZGlhUmVjb3JkZXIgJiYgdHlwZW9mIHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9PT0gJ2Z1bmN0aW9uJyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQGFjY2VzcyBwcml2YXRlXHJcbiAqIFxyXG4gKiBBbGwgYXZhaWxhYmxlIG1pbWUgdHlwZXMgaW4gYnJvd3NlciBlbnZpcm9ubWVudC5cclxuICogQHR5cGUge09iamVjdH1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzID0ge1xyXG4gICAgJ2F1ZGlvJzogW1xyXG4gICAgICAgICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyxcclxuICAgICAgICAnYXVkaW8vd2VibScsXHJcbiAgICAgICAgJ2F1ZGlvL29nZydcclxuICAgIF0sXHJcbiAgICAndmlkZW8nOiBbXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWgyNjQnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1kYWFsYScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNraW5nIGFsbCBtaW1lIHR5cGVzIGZvciBzdXBwb3J0IGluIGJyb3dzZXIgZW52aXJvbWVudC4gUmVjb21tZW5kZWQgbWltZSB0eXBlIGhhcyAwIGluZGV4LlxyXG4gKiBcclxuICogQHBhcmFtICB7c3RyaW5nfSBwcmVmZmVyZWRUeXBlTWVkaWEgJ2F1ZGlvJyBvciAndmlkZW8nLiBXaGF0IHR5cGUgb2YgbWVkaWEgeW91IHdhbnQgdG8gY2hlY2sgc3VwcG9ydC5cclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQnkgZGVmYXVsdCBpcyAndmlkZW8nLlxyXG4gKiBAcmV0dXJuIHthcnJheX0gICAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBzdXBwb3J0ZWQgbWltZXR5cGVzLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyA9IGZ1bmN0aW9uKHByZWZmZXJlZFR5cGVNZWRpYSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIHN1cHBvcnRlZE1pbWVUeXBlID0gW10sXHJcbiAgICAgICAgdHlwZU1lZGlhID0gcHJlZmZlcmVkVHlwZU1lZGlhIHx8ICd2aWRlbyc7XHJcblxyXG4gICAgaWYoIXFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBxYk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlc1t0eXBlTWVkaWFdLmZpbHRlcihmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgICAgIHJldHVybiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGEgW3N0YXRlIG9mIHJlY29yZGluZ10oaHR0cHM6Ly93M2MuZ2l0aHViLmlvL21lZGlhY2FwdHVyZS1yZWNvcmQvTWVkaWFSZWNvcmRlci5odG1sI2lkbC1kZWYtcmVjb3JkaW5nc3RhdGUpLlxyXG4gKiBQb3NzaWJseSBzdGF0ZXM6ICoqaW5hY3RpdmUqKiwgKipyZWNvcmRpbmcqKiwgKipwYXVzZWQqKlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE5hbWUgb2YgYSBzdGF0ZS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZWRpYVJlY29yZGVyID8gdGhpcy5fbWVkaWFSZWNvcmRlci5zdGF0ZSA6ICdpbmFjdGl2ZSc7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RhcnQgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBGaXJlIHRoZSBtZXRob2QgYHN0b3BgIGlmIHJlY29yZCBoYXMgc3RhdGUgYGlucHJvZ3Jlc3NgLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpcmVDYWxsYmFjayhuYW1lLCBhcmdzKSB7XHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXShhcmdzKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicgKyBuYW1lLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gc2VsZi5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3JlY29yZGluZycgfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncGF1c2VkJyl7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyogQ2xlYXIgZGF0YSBmcm9tIHByZXZpb3VzbHkgcmVjb3JkaW5nICovIFxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5sZW5ndGggPSAwO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHNlbGYuX29wdGlvbnMpO1xyXG4gICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgY29uc29sZS5pbmZvKEVSUk9SUy51bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMsIGUpO1xyXG5cclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5wdXNoKGUuZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29uUGF1c2UnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25SZXN1bWUnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICBzd2l0Y2goZXJyb3IubmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdJbnZhbGlkU3RhdGUnOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdXRPZk1lbW9yeSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0lsbGVnYWxTdHJlYW1Nb2RpZmljYXRpb24nOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdGhlclJlY29yZGluZ0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnR2VuZXJpY0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ01lZGlhUmVjb3JkZXIgRXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ3N0b3BwZWQnKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vbkVycm9yUmVjb3JkaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25FcnJvcicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2Ioc2VsZi5fcmVjb3JkZWRDaHVua3MsIHtcclxuICAgICAgICAgICAgJ3R5cGUnIDogc2VsZi5fb3B0aW9ucy5taW1lVHlwZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29uU3RvcCcsIGJsb2IpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KHNlbGYuX3RpbWVTbGljZSk7XHJcblxyXG4gICAgZmlyZUNhbGxiYWNrKCdvblN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIuc3RhdGU7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnKXtcclxuICAgICAgICBtZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFBhdXNlIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5wYXVzZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzdW1lIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBmaWxlIGZyb20gYmxvYiBhbmQgZG93bmxvYWQgYXMgdGhlIGZpbGUuIEl0cyBtZXRob2Qgd2lsbCBmaXJlICdzdG9wJyBpZiByZWNvcmRpbmcgaW4gcHJvZ3Jlc3MuXHJcbiAqIEBwYXJhbSAge1N0cmludH0gZmlsZU5hbWUgTmFtZSBvZiBmaWxlLiBZb3UgY2FuIHNldCBgZmFsc2VgIGFuZCB3ZSBhcmUgZ2VuZXJhdGUgbmFtZSBvZiBmaWxlIGJhc2VkIG9uIERhdGUubm93KClcclxuICogQHBhcmFtICB7QmxvYn0gICBibG9iICAgICBZb3UgY2FuIHNldCBibG9iIHdoaWNoIHlvdSBnZXQgZnJvbSB0aGUgbWV0aG9kIGBzdG9wYCBvciBkb24ndCBzZXQgYW55dGhpbmcgYW5kXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgd2Ugd2lsbCBnZXQgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbihmaWxlTmFtZSwgYmxvYikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyID0gdGhpcy5fbWVkaWFSZWNvcmRlcixcclxuICAgICAgICBtZWRpYVJlY29yZGVyU3RhdGUgPSBtZWRpYVJlY29yZGVyLnN0YXRlO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLyogU3RhcnQgZG93bG9hZGluZyAqL1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgXHJcbiAgICAvKiBSZW1vdmUgbGluayAqL1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcmV0dXJuIHtCbG9ifVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0QmxvYlJlY29yZGVkID0gZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGNodW5rcyA9IGRhdGEgfHwgc2VsZi5fcmVjb3JkZWRDaHVua3M7XHJcblxyXG4gICAgaWYoIWNodW5rcy5sZW5ndGgpIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLm5vX3JlY29yZGVkX2NodW5rcyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBuZXcgQmxvYihjaHVua3MsIHsgJ3R5cGUnIDogc2VsZi5fb3B0aW9ucy5taW1lVHlwZSB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYSBleHRlbnNpb24gb2YgYSBmaWxlLiBCYXNlZCBvbiBhdmFpYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxYk1lZGlhUmVjb3JkZXI7XHJcbiJdfQ==
