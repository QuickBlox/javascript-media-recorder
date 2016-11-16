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

    self._stream;
    
    self._mediaRecorder = null;
    self._recordedChunks = [];

    self._timeSlice = opts && opts.timeSlice ? opts.timeSlice : 1000;
    self._userCallbacks = opts && opts.callbacks ? opts.callbacks : null; 

    var typeMediaRecorded = 'video', // by default
        prefferedMimeType = opts && opts.mimeType;

    if(prefferedMimeType) {
        typeMediaRecorded = prefferedMimeType.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
    }

    /** prepare a stream */
    // if(typeMediaRecorded === 'audio') {
    //     self._stream = new window.MediaStream();
    //     self._stream.addTrack(stream.getAudioTracks()[0]);
    // }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIEpTSGludCBpbmxpbmUgKi8gXHJcbi8qIGpzaGludCBub2RlOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9e1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsIFxyXG4gICAgJ0ludmFsaWRTdGF0ZSc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IGluIGEgc3RhdGUgaW4gd2hpY2ggdGhlIHByb3Bvc2VkIG9wZXJhdGlvbiBpcyBhbGxvd2VkIHRvIGJlIGV4ZWN1dGVkLicsXHJcbiAgICAnT3V0T2ZNZW1vcnknOiAnVGhlIFVBIGhhcyBleGhhdXNlZCB0aGUgYXZhaWxhYmxlIG1lbW9yeS4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ0lsbGVnYWxTdHJlYW1Nb2RpZmljYXRpb24nOiAnQSBtb2RpZmljYXRpb24gdG8gdGhlIHN0cmVhbSBoYXMgb2NjdXJyZWQgdGhhdCBtYWtlcyBpdCBpbXBvc3NpYmxlIHRvIGNvbnRpbnVlIHJlY29yZGluZy4gQW4gZXhhbXBsZSB3b3VsZCBiZSB0aGUgYWRkaXRpb24gb2YgYSBUcmFjayB3aGlsZSByZWNvcmRpbmcgaXMgb2NjdXJyaW5nLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnT3RoZXJSZWNvcmRpbmdFcnJvcic6ICdVc2VkIGZvciBhbiBmYXRhbCBlcnJvciBvdGhlciB0aGFuIHRob3NlIGxpc3RlZCBhYm92ZS4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ0dlbmVyaWNFcnJvcic6ICdUaGUgVUEgY2Fubm90IHByb3ZpZGUgdGhlIGNvZGVjIG9yIHJlY29yZGluZyBvcHRpb24gdGhhdCBoYXMgYmVlbiByZXF1ZXN0ZWQnXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVSUk9SUzsiLCIvKiBKU0hpbnQgaW5saW5lIHJ1bGVzICovXHJcbi8qIGpzaGludCBub2RlOiB0cnVlLCBicm93c2VyOiB0cnVlICovIFxyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEVSUk9SUyA9IHJlcXVpcmUoJy4vZXJyb3JzJyk7XHJcblxyXG4vKiogIFxyXG4gKiBAY29uc3RydWN0b3IgcWJNZWRpYVJlY29yZGVyXHJcbiAqIEBwYXJhbSAge21lZGlhU3RyZWFtfSBzdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHBhcmFtICB7b2JqZWN0fSBvcHRzICAgICAgICBzZWUgZXhhbXBsZVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBvcHRzID0ge1xyXG4gKiAgICAgbWltZVR5cGU6ICdhdWRpbycsICAgICAgIC8vIHNldCBtaW1lIHR5cGUgb2YgcmVjb3JkIG1lZGlhIG9yIG9ubHkgdHlwZSBvZiBtZWRpYTogJ3ZpZGVvJy8nYXVkaW8nLlxyXG4gKiAgICAgaWdub3JlTXV0ZWRNZWRpYTogZmFsc2UsIC8vIFdoYXQgdG8gZG8gd2l0aCBhIG11dGVkIGlucHV0IE1lZGlhU3RyZWFtVHJhY2ssXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZS5nLiBpbnNlcnQgYmxhY2sgZnJhbWVzL3plcm8gYXVkaW8gdm9sdW1lIGluIHRoZSByZWNvcmRpbmcgb3IgaWdub3JlIGFsdG9nZXRoZXIuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQnkgZGVmYXVsdCBpcyBgdHJ1ZWAuXHJcbiAqICAgICB0aW1lU2xpY2U6IDEwMDAsICAgICAgICAgLy8gb3B0aW9uYWxseSBiZSBwYXNzZWQgYSB0aW1lc2xpY2UgYXJndW1lbnQgd2l0aCBhIHZhbHVlIGluIG1pbGxpc2Vjb25kcy5cclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbWVkaWEgd2lsbCBiZSBjYXB0dXJlZCBpbiBzZXBhcmF0ZSBjaHVua3Mgb2YgdGhhdCBkdXJhdGlvbixcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByYXRoZXIgdGhhbiB0aGUgZGVmYXVsdCBiZWhhdmlvciBvZiByZWNvcmRpbmcgdGhlIG1lZGlhIGluIGEgc2luZ2xlIGxhcmdlIGNodW5rLlxyXG4gKiAgICAgY2FsbGJhY2tzOiB7ICAgICAgICAgICAgIC8vIE5vdGUhIFVzZSBuYW1lZCBmdW5jdGlvbiBmb3IgYmV0dGVyIGRlYnVnLlxyXG4gKiAgICAgICAgIG9uU3RhcnQ6IGZ1bmN0aW9uIHN0YXJ0UmVjb3JkKCkge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25FcnJvcjogZnVuY3Rpb24gZXJyb3JSZWNvcmQoZXJyb3IpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9LFxyXG4gKiAgICAgICAgIG9uUGF1c2U6IGZ1bmN0aW9uIHBhdXNlUmVjb3JkKCkge1xyXG4gKiAgICAgICAgICAgICAvLy4uLlxyXG4gKiAgICAgICAgIH0sXHJcbiAqICAgICAgICAgb25TdG9wOiBmdW5jdGlvbiBzdG9wUmVjb3JkKGJsb2IpIHtcclxuICogICAgICAgICAgICAgLy8uLi5cclxuICogICAgICAgICB9LFxyXG4gKiAgICAgICAgIG9uUmVzdW1lOiBmdW5jdGlvbiByZXNpbWVSZWNvcmQoKSB7XHJcbiAqICAgICAgICAgICAgIC8vLi4uXHJcbiAqICAgICAgICAgfVxyXG4gKiAgICAgfVxyXG4gKiB9XHJcbiAqL1xyXG5mdW5jdGlvbiBxYk1lZGlhUmVjb3JkZXIoc3RyZWFtLCBvcHRzKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3N0cmVhbTtcclxuICAgIFxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcyA9IFtdO1xyXG5cclxuICAgIHNlbGYuX3RpbWVTbGljZSA9IG9wdHMgJiYgb3B0cy50aW1lU2xpY2UgPyBvcHRzLnRpbWVTbGljZSA6IDEwMDA7XHJcbiAgICBzZWxmLl91c2VyQ2FsbGJhY2tzID0gb3B0cyAmJiBvcHRzLmNhbGxiYWNrcyA/IG9wdHMuY2FsbGJhY2tzIDogbnVsbDsgXHJcblxyXG4gICAgdmFyIHR5cGVNZWRpYVJlY29yZGVkID0gJ3ZpZGVvJywgLy8gYnkgZGVmYXVsdFxyXG4gICAgICAgIHByZWZmZXJlZE1pbWVUeXBlID0gb3B0cyAmJiBvcHRzLm1pbWVUeXBlO1xyXG5cclxuICAgIGlmKHByZWZmZXJlZE1pbWVUeXBlKSB7XHJcbiAgICAgICAgdHlwZU1lZGlhUmVjb3JkZWQgPSBwcmVmZmVyZWRNaW1lVHlwZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgIH1cclxuXHJcbiAgICAvKiogcHJlcGFyZSBhIHN0cmVhbSAqL1xyXG4gICAgLy8gaWYodHlwZU1lZGlhUmVjb3JkZWQgPT09ICdhdWRpbycpIHtcclxuICAgIC8vICAgICBzZWxmLl9zdHJlYW0gPSBuZXcgd2luZG93Lk1lZGlhU3RyZWFtKCk7XHJcbiAgICAvLyAgICAgc2VsZi5fc3RyZWFtLmFkZFRyYWNrKHN0cmVhbS5nZXRBdWRpb1RyYWNrcygpWzBdKTtcclxuICAgIC8vIH1cclxuXHJcbiAgICBzZWxmLl9vcHRpb25zID0ge1xyXG4gICAgICAgIG1pbWVUeXBlOiBxYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGVNZWRpYVJlY29yZGVkLCBwcmVmZmVyZWRNaW1lVHlwZSlbMF0sXHJcbiAgICAgICAgaWdub3JlTXV0ZWRNZWRpYTogb3B0cyAmJiB0eXBlb2Ygb3B0cy5pZ25vcmVNdXRlZE1lZGlhICE9PSB1bmRlZmluZWQgPyBvcHRzLmlnbm9yZU11dGVkTWVkaWEgOiB0cnVlXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2tpbmcgaXMgZW52aXJvbm1lbnQgc3VwcG9ydHMgcmVjb3JkaW5nLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHFiTWVkaWFSZWNvcmRlciBpcyBhdmFpbGFibGUgYW5kIGNhbiBydW4sIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSA9IGZ1bmN0aW9uKCl7XHJcbiAgICByZXR1cm4gISEod2luZG93ICYmIHdpbmRvdy5NZWRpYVJlY29yZGVyICYmIHR5cGVvZiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPT09ICdmdW5jdGlvbicpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBcclxuICogQWxsIGF2YWlsYWJsZSBtaW1lIHR5cGVzIGluIGJyb3dzZXIgZW52aXJvbm1lbnQuXHJcbiAqIEB0eXBlIHtPYmplY3R9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlcyA9IHtcclxuICAgICdhdWRpbyc6IFtcclxuICAgICAgICAnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsXHJcbiAgICAgICAgJ2F1ZGlvL3dlYm0nLFxyXG4gICAgICAgICdhdWRpby9vZ2cnXHJcbiAgICBdLFxyXG4gICAgJ3ZpZGVvJzogW1xyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1oMjY0JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA5JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9dnA4JyxcclxuICAgICAgICAndmlkZW8vd2VibTtjb2RlY3M9ZGFhbGEnLFxyXG4gICAgICAgICd2aWRlby93ZWJtJyxcclxuICAgICAgICAndmlkZW8vbXA0JyxcclxuICAgICAgICAndmlkZW8vbXBlZydcclxuICAgIF1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja2luZyBhbGwgbWltZSB0eXBlcyBmb3Igc3VwcG9ydCBpbiBicm93c2VyIGVudmlyb21lbnQuIFJlY29tbWVuZGVkIG1pbWUgdHlwZSBoYXMgMCBpbmRleC5cclxuICogXHJcbiAqIEBwYXJhbSAge3N0cmluZ30gcHJlZmZlcmVkVHlwZU1lZGlhICdhdWRpbycgb3IgJ3ZpZGVvJy4gV2hhdCB0eXBlIG9mIG1lZGlhIHlvdSB3YW50IHRvIGNoZWNrIHN1cHBvcnQuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5IGRlZmF1bHQgaXMgJ3ZpZGVvJy5cclxuICogQHJldHVybiB7YXJyYXl9ICAgICAgICAgICAgICAgICAgICAgQXJyYXkgb2Ygc3VwcG9ydGVkIG1pbWV0eXBlcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMgPSBmdW5jdGlvbihwcmVmZmVyZWRUeXBlTWVkaWEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBzdXBwb3J0ZWRNaW1lVHlwZSA9IFtdLFxyXG4gICAgICAgIHR5cGVNZWRpYSA9IHByZWZmZXJlZFR5cGVNZWRpYSB8fCAndmlkZW8nO1xyXG5cclxuICAgIGlmKCFxYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcWJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXNbdHlwZU1lZGlhXS5maWx0ZXIoZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgICAgICByZXR1cm4gd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogRmlyZSB0aGUgbWV0aG9kIGBzdG9wYCBpZiByZWNvcmQgaGFzIHN0YXRlIGBpbnByb2dyZXNzYC5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBmaXJlQ2FsbGJhY2sobmFtZSwgYXJncykge1xyXG4gICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3NbbmFtZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHNlbGYuX3VzZXJDYWxsYmFja3NbbmFtZV0oYXJncyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRm91bmRlZCBhbiBlcnJvciBpbiBjYWxsYmFjazonICsgbmFtZSwgZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyogQ2xlYXIgZGF0YSBmcm9tIHByZXZpb3VzbHkgcmVjb3JkaW5nICovIFxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5sZW5ndGggPSAwO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHNlbGYuX29wdGlvbnMpO1xyXG4gICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgY29uc29sZS5pbmZvKEVSUk9SUy51bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMsIGUpO1xyXG5cclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5wdXNoKGUuZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29uUGF1c2UnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25SZXN1bWUnKTtcclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbmVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICBzd2l0Y2goZXJyb3IubmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdJbnZhbGlkU3RhdGUnOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdXRPZk1lbW9yeSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ0lsbGVnYWxTdHJlYW1Nb2RpZmljYXRpb24nOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdPdGhlclJlY29yZGluZ0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnR2VuZXJpY0Vycm9yJzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ01lZGlhUmVjb3JkZXIgRXJyb3InLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdpbmFjdGl2ZScgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ3N0b3BwZWQnKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrcy5vbkVycm9yUmVjb3JkaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25FcnJvcicsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2Ioc2VsZi5fcmVjb3JkZWRDaHVua3MsIHtcclxuICAgICAgICAgICAgJ3R5cGUnIDogc2VsZi5fb3B0aW9ucy5taW1lVHlwZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBmaXJlQ2FsbGJhY2soJ29uU3RvcCcsIGJsb2IpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KHNlbGYuX3RpbWVTbGljZSk7XHJcblxyXG4gICAgZmlyZUNhbGxiYWNrKCdvblN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIuc3RhdGU7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnKXtcclxuICAgICAgICBtZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFBhdXNlIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdyZWNvcmRpbmcnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5wYXVzZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLmFjdGlvbkZhaWxlZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogUmVzdW1lIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYSBbc3RhdGUgb2YgcmVjb3JkaW5nXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTWVkaWFSZWNvcmRlci9zdGF0ZSkuXHJcbiAqIFBvc3NpYmx5LCBpbmFjdGl2ZSAvIHBhdXNlZCAvIHJlY29yZGluZyBcclxuICogQHJldHVybiB7U3RyaW5nfSBBIHN0YXRlIG9mIHJlY29yZGluZy4gXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5fbWVkaWFSZWNvcmRlci5zdGF0ZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBmaWxlIGZyb20gYmxvYiBhbmQgZG93bmxvYWQgYXMgdGhlIGZpbGUuIEl0cyBtZXRob2Qgd2lsbCBmaXJlICdzdG9wJyBpZiByZWNvcmRpbmcgaW4gcHJvZ3Jlc3MuXHJcbiAqIEBwYXJhbSAge1N0cmludH0gZmlsZU5hbWUgTmFtZSBvZiBmaWxlLiBZb3UgY2FuIHNldCBgZmFsc2VgIGFuZCB3ZSBhcmUgZ2VuZXJhdGUgbmFtZSBvZiBmaWxlIGJhc2VkIG9uIERhdGUubm93KClcclxuICogQHBhcmFtICB7QmxvYn0gICBibG9iICAgICBZb3UgY2FuIHNldCBibG9iIHdoaWNoIHlvdSBnZXQgZnJvbSB0aGUgbWV0aG9kIGBzdG9wYCBvciBkb24ndCBzZXQgYW55dGhpbmcgYW5kXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgd2Ugd2lsbCBnZXQgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZG93bmxvYWQgPSBmdW5jdGlvbihmaWxlTmFtZSwgYmxvYikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyID0gdGhpcy5fbWVkaWFSZWNvcmRlcixcclxuICAgICAgICBtZWRpYVJlY29yZGVyU3RhdGUgPSBtZWRpYVJlY29yZGVyLnN0YXRlO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLyogU3RhcnQgZG93bG9hZGluZyAqL1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgXHJcbiAgICAvKiBSZW1vdmUgbGluayAqL1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcmV0dXJuIHtCbG9ifVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0QmxvYlJlY29yZGVkID0gZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICAgIGNodW5rcyA9IGRhdGEgfHwgc2VsZi5fcmVjb3JkZWRDaHVua3M7XHJcblxyXG4gICAgaWYoIWNodW5rcy5sZW5ndGgpIHtcclxuICAgICAgICBjb25zb2xlLndhcm4oRVJST1JTLm5vX3JlY29yZGVkX2NodW5rcyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBuZXcgQmxvYihjaHVua3MsIHsgJ3R5cGUnIDogc2VsZi5fb3B0aW9ucy5taW1lVHlwZSB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYSBleHRlbnNpb24gb2YgYSBmaWxlLiBCYXNlZCBvbiBhdmFpYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHFiTWVkaWFSZWNvcmRlcjtcclxuIl19
