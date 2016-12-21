(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = {
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
},{}],2:[function(require,module,exports){
'use strict';

var ERRORS = require('./errors');

/**
 * @constructor qbMediaRecorder
 * @param {Object}   [options] - Object of parameters.
 * @param {String}   options[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm';
 * @param {Number}   options[].timeslice=1000 - The minimum number of milliseconds of data to return in a single Blob, fire 'ondataavaible' callback.
 * @param {Boolean}  options[].ignoreMutedMedia=true - What to do with a muted input MediaStreamTrack, e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 * @param {Function} options[].onstart - Called to handle the start event.
 * @param {Function} options[].onstop - Called to handle the stop event.
 * @param {Function} options[].onpause - Called to handle the pause event.
 * @param {Function} options[].onresume - Called to handle the resume event.
 * @param {Function} options[].onerror - Called to handle an ErrorEvent.
 * @param {Function} options[].onchange - Called to handle the change a stream event.
 * @param {Function} options[].ondataavailable - Called to handle the dataavailable event. The Blob of recorded data is contained in this event.
 *
 * @example
 * var options = {
 *     onstart: function onStart() { // Use named function.
 *         console.log('Recorder is started');
 *     },
 *     onstop: function onStop(Blob) {
 *         videoElement.src = URL.createObjectURL(blob);
 *     }
 * };
 *
 * // uses as global variable, qbMediaRecorder is built as a UMD module.
 * var recorder = new qbMediaRecorder(options);
 *
 */
function qbMediaRecorder(opts) {
    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    var prefferedMimeType = opts && opts.mimeType ? opts.mimeType : false;

    this.mimeType = this._getMimeType(prefferedMimeType);
    this.timeslice = opts && opts.timeslice && isNaN(+opts.timeslice) ? opts.timeslice : 1000;
    this.callbacks = opts ? this._getCallbacks(opts) : {};
    this.recordedBlobs = [];
    this.ignoreMutedMedia = opts && typeof(opts.ignoreMutedMedia) === 'boolean' ? opts.ignoreMutedMedia : true;
    
    this._stream = null;
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._keepRecording = false;
}

qbMediaRecorder._mimeTypes = require('./mimeTypes');

qbMediaRecorder._STATES = ['inactive', 'recording', 'paused'];

/**
 * It checks capability of recording in the environment.
 * Checks MediaRecorder, MediaRecorder.isTypeSupported and Blob.
 * @return {Boolean} Returns true if the qbMediaRecorder is available and can run, or false otherwise.
 *
 * @example
 * if(qbMediaRecorder.isAvailable()) {
 *     // ... show UI for recording
 * }
 */
qbMediaRecorder.isAvailable = function(){
    return !!(window && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function' && window.Blob);
}

/**
 * Returns a Boolean which is true if the MIME type specified is one the user agent can record.
 * @param  {String}  mimeType - The mimeType to check.
 * @return {Boolean}            true if the MediaRecorder implementation is capable of recording Blob objects for the specified MIME type.
 */
qbMediaRecorder.isTypeSupported = function(mimeType) {
    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return window.MediaRecorder.isTypeSupported(mimeType);
}

/**
 * Return all supported mime types and container format.
 * @param  {String} [mimeType=video] Type of media.
 * @return {Array}                   Array of supported mimetypes.Recommended mimetype has 0 index.
 *
 * @example
 * var mimeType = qbMediaRecorder.getSupportedMimeTypes('audio');
 * console.info(`Call will recording in ${mimeType[0]}`);
 */
qbMediaRecorder.getSupportedMimeTypes = function(type) {
    var typeMedia = type || 'video';

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    return qbMediaRecorder._mimeTypes[typeMedia].filter(function(mimeType) {
        return qbMediaRecorder.isTypeSupported(mimeType);
    });
}

qbMediaRecorder.prototype._getCallbacks = function(opts) {
    var callbacks = {},
        callbackNames = ['onstart', 'onstop', 'onpause', 'onresume', 'onerror', 'onchange', 'ondataavailable'];

    callbackNames.forEach(function(name) {
        if (name in opts) {
            callbacks[name] = opts[name];
        }
    });

    return callbacks;
}

qbMediaRecorder.prototype._getMimeType = function (preffered) {
    var mimeType,
        type = 'video';

    if(preffered && qbMediaRecorder.isTypeSupported(preffered)) {
        mimeType = preffered;
    } else if(preffered) {
        type = preffered.toString().toLowerCase().indexOf('audio') === -1 ? 'video' : 'audio';
        mimeType = qbMediaRecorder.getSupportedMimeTypes(type)[0];
    } else {
        mimeType = qbMediaRecorder.getSupportedMimeTypes(type)[0];
    }

    return mimeType;
}

/**
 * Return the current [state of qbMediaRecorder instance](https://w3c.github.io/mediacapture-record/MediaRecorder.html#idl-def-recordingstate).
 * Possibly states: **inactive**, **recording**, **paused**.
 * @return {String} Name of a state.
 *
 * @example
 * var recorder = new qbMediaRecorder();
 * // ...some code
 *
 * if(recorder.getState() == 'recording') {
 *     console.info('You are still recording.');
 * }
 */
qbMediaRecorder.prototype.getState = function() {
    return this._mediaRecorder ? this._mediaRecorder.state : qbMediaRecorder._STATES[0];
}

/**
 * Start to recording a stream.
 * Fire the method `stop` if an instance inprogress (has a state recording or paused).
 * Fire onstart callback.
 * @param {MediaStream} stream - Stream object representing a flux of audio- or video-related data.
 * @returns {void}
 */
qbMediaRecorder.prototype.start = function(stream) {
    var self = this;

    var mediaRecorderState = self.getState();

    if(mediaRecorderState === qbMediaRecorder._STATES[1] || mediaRecorderState === qbMediaRecorder._STATES[2]) {
        self._mediaRecorder.stop();
    }

    if(self._stream) {
        self._stream = null;
    }

    self._stream = stream;

    self._mediaRecorder = null;
    self._recordedChunks.length = 0;

    try {
        self._mediaRecorder = new window.MediaRecorder(self._stream, self._options);
    } catch(e) {
        console.warn(ERRORS.unsupportMediaRecorderWithOptions, e);

        self._mediaRecorder = new window.MediaRecorder(self._stream);
    }

    self._setEvents();
};

// qbMediaRecorder.prototype._setEvents = function() {
//     var self = this;

//     function fireCallback(name, args) {
//         if(self._userCallbacks && typeof self._userCallbacks[name] === 'function') {
//             try {
//                 self._userCallbacks[name](args);
//             } catch(e) {
//                 console.error('Founded an error in callback:' + name, e);
//             }
//         }
//     }

//     self._mediaRecorder.ondataavailable = function(e) {
//         if(e.data && e.data.size > 0) {
//             self._recordedChunks.push(e.data);
//             fireCallback('ondataavailable', e);
//         }
//     };

//     self._mediaRecorder.onpause = function() {
//         fireCallback('onPause');
//     };

//     self._mediaRecorder.onresume = function() {
//         fireCallback('onResume');
//     };

//     self._mediaRecorder.onerror = function(error) {
//         switch(error.name) {
//             case 'InvalidState':
//                 console.error(ERRORS[error.name]);
//                 break;

//             case 'OutOfMemory':
//                 console.error(ERRORS[error.name]);
//                 break;

//             case 'IllegalStreamModification':
//                 console.error(ERRORS[error.name]);
//                 break;

//             case 'OtherRecordingError':
//                 console.error(ERRORS[error.name]);
//                 break;

//             case 'GenericError':
//                 console.error(ERRORS[error.name]);
//                 break;

//             default:
//                 console.error('MediaRecorder Error', error);
//                 break;
//         }

//         if(self._mediaRecorder.state !== 'inactive' && self._mediaRecorder.state !== 'stopped') {
//             self._mediaRecorder.stop();
//         }

//         if(self._userCallbacks && typeof self._userCallbacks.onErrorRecording === 'function') {
//             fireCallback('onError', error);
//         }
//     };

//     self._mediaRecorder.onstop = function() {
//         // console.info()
//         var blob = new Blob(self._recordedChunks, {
//             'type' : self._options.mimeType
//         });

//         self._recordedBlobs.push(blob);

//         if(!self._keepRecording) {
//             console.info('self._recordedBlobs', self._recordedBlobs);

//             if(self._recordedBlobs.length > 1) {
//                 fireCallback('onStop', new Blob(self._recordedBlobs, {type: self._options.mimeType}));
//             } else {
//                 fireCallback('onStop', self._recordedBlobs[0]);
//             }
//         }

//         self._keepRecording = false;
//     };

//     self._mediaRecorder.start(self._timeSlice);

//     fireCallback('onStart');
// };



// qbMediaRecorder.prototype.change = function(stream) {
//     var self = this;

//     self._keepRecording = true; // don't stop a record
//     self.stop();

//      self._stream = null;
//      self._mediaRecorder = null;

//     self._stream = stream;
//     self._mediaRecorder = new window.MediaRecorder(self._stream, self._options);
//     self._setEvents();
// };

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
// qbMediaRecorder.prototype.stop = function() {
//     var mediaRecorder = this._mediaRecorder,
//         mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

//     if(mediaRecorder && mediaRecorderState === 'recording'){
//         mediaRecorder.stop();
//     } else {
//         console.warn(ERRORS.actionFailed);
//     }
// };

/**
 * Pause to recording a stream.
 * @returns {void}
 */
// qbMediaRecorder.prototype.pause = function() {
//     var self = this;

//     if(self._mediaRecorder && self._mediaRecorder.state === 'recording') {
//         self._mediaRecorder.pause();
//     } else {
//         console.warn(ERRORS.actionFailed);
//     }
// };

/**
 * Resume to recording a stream.
 * @returns {void}
 */
// qbMediaRecorder.prototype.resume = function() {
//     var self = this;

//     if(self._mediaRecorder && self._mediaRecorder.state === 'paused') {
//         self._mediaRecorder.resume();
//     } else {
//         console.warn(ERRORS.actionFailed);
//     }
// };

/**
 * Create a file from blob and download as the file. Its method will fire 'stop' if recording in progress.
 * @param  {Strint} fileName Name of file. You can set `false` and we are generate name of file based on Date.now().
 * @param  {Blob}   blob     You can set blob which you get from the method `stop` or don't set anything and
 *                           we will get recorded chuncks.
 * @returns {void}
 */
// qbMediaRecorder.prototype.download = function(fileName, blob) {
//     var self = this;

//     var mediaRecorder = this._mediaRecorder,
//         mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

//     if(mediaRecorder && mediaRecorderState === 'recording') {
//         mediaRecorder.stop();
//     }

//     var url = URL.createObjectURL(blob || self._getBlobRecorded()),
//         a = document.createElement('a');

//     a.style.display = 'none';
//     a.href = url;
//     a.download = (fileName || Date.now()) + '.' + self._getExtension();

//     document.body.appendChild(a);

//     /* Start dowloading */
//     a.click();
    
//     /* Remove link */
//     setTimeout(function() {
//         document.body.removeChild(a);
//         window.URL.revokeObjectURL(url);
//     }, 100);
// };

/**
 * Create a Blob from recorded chunks.
 * @access private
 * @param {Object} [data] - Recorded data.
 * @return {Object} - Blob of recorded media or what you set in data
 */
// qbMediaRecorder.prototype._getBlobRecorded = function(data) {
//     var self = this,
//         chunks = data || self._recordedChunks;

//     if(!chunks.length) {
//         console.warn(ERRORS.no_recorded_chunks);
//         return false;
//     }

//     return new Blob(chunks, { 'type' : self._options.mimeType });
// };

/**
 * Return a extension of a file. Based on available mimeType.
 * @access private
 * @return {String} For example, 'webm' / 'mp4' / 'ogg'
 */
// qbMediaRecorder.prototype._getExtension = function() {
//     var self = this;

//     var endTypeMedia = self._options.mimeType.indexOf('/'),
//         extension = self._options.mimeType.substring(endTypeMedia + 1),
//         startCodecsInfo = extension.indexOf(';');

//     if(startCodecsInfo !== -1) {
//         extension = extension.substring(0, startCodecsInfo);
//     }

//     return extension;
// };

module.exports = qbMediaRecorder;

},{"./errors":1,"./mimeTypes":3}],3:[function(require,module,exports){
'use strict';

module.exports = {
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
},{}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4WkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqXHJcbiAqIEBjb25zdHJ1Y3RvciBxYk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtIHtPYmplY3R9ICAgW29wdGlvbnNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgIG9wdGlvbnNbXS5taW1lVHlwZT12aWRlbyAtIFNwZWNpZmllcyB0aGUgbWVkaWEgdHlwZSBhbmQgY29udGFpbmVyIGZvcm1hdCBmb3IgdGhlIHJlY29yZGluZy4gWW91IGNhbiBzZXQgc2ltcGx5OiAndmlkZW8nIG9yICdhdWRpbycgb3IgJ2F1ZGlvL3dlYm0nO1xyXG4gKiBAcGFyYW0ge051bWJlcn0gICBvcHRpb25zW10udGltZXNsaWNlPTEwMDAgLSBUaGUgbWluaW11bSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIG9mIGRhdGEgdG8gcmV0dXJuIGluIGEgc2luZ2xlIEJsb2IsIGZpcmUgJ29uZGF0YWF2YWlibGUnIGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59ICBvcHRpb25zW10uaWdub3JlTXV0ZWRNZWRpYT10cnVlIC0gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjaywgZS5nLiBpbnNlcnQgYmxhY2sgZnJhbWVzL3plcm8gYXVkaW8gdm9sdW1lIGluIHRoZSByZWNvcmRpbmcgb3IgaWdub3JlIGFsdG9nZXRoZXIuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnNbXS5vbnN0YXJ0IC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RhcnQgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnNbXS5vbnN0b3AgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBzdG9wIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zW10ub25wYXVzZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHBhdXNlIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zW10ub25yZXN1bWUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSByZXN1bWUgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnNbXS5vbmVycm9yIC0gQ2FsbGVkIHRvIGhhbmRsZSBhbiBFcnJvckV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zW10ub25jaGFuZ2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBjaGFuZ2UgYSBzdHJlYW0gZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnNbXS5vbmRhdGFhdmFpbGFibGUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBkYXRhYXZhaWxhYmxlIGV2ZW50LiBUaGUgQmxvYiBvZiByZWNvcmRlZCBkYXRhIGlzIGNvbnRhaW5lZCBpbiB0aGlzIGV2ZW50LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgb3B0aW9ucyA9IHtcclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7IC8vIFVzZSBuYW1lZCBmdW5jdGlvbi5cclxuICogICAgICAgICBjb25zb2xlLmxvZygnUmVjb3JkZXIgaXMgc3RhcnRlZCcpO1xyXG4gKiAgICAgfSxcclxuICogICAgIG9uc3RvcDogZnVuY3Rpb24gb25TdG9wKEJsb2IpIHtcclxuICogICAgICAgICB2aWRlb0VsZW1lbnQuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICogICAgIH1cclxuICogfTtcclxuICpcclxuICogLy8gdXNlcyBhcyBnbG9iYWwgdmFyaWFibGUsIHFiTWVkaWFSZWNvcmRlciBpcyBidWlsdCBhcyBhIFVNRCBtb2R1bGUuXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBxYk1lZGlhUmVjb3JkZXIob3B0aW9ucyk7XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiBxYk1lZGlhUmVjb3JkZXIob3B0cykge1xyXG4gICAgaWYoIXFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcmVmZmVyZWRNaW1lVHlwZSA9IG9wdHMgJiYgb3B0cy5taW1lVHlwZSA/IG9wdHMubWltZVR5cGUgOiBmYWxzZTtcclxuXHJcbiAgICB0aGlzLm1pbWVUeXBlID0gdGhpcy5fZ2V0TWltZVR5cGUocHJlZmZlcmVkTWltZVR5cGUpO1xyXG4gICAgdGhpcy50aW1lc2xpY2UgPSBvcHRzICYmIG9wdHMudGltZXNsaWNlICYmIGlzTmFOKCtvcHRzLnRpbWVzbGljZSkgPyBvcHRzLnRpbWVzbGljZSA6IDEwMDA7XHJcbiAgICB0aGlzLmNhbGxiYWNrcyA9IG9wdHMgPyB0aGlzLl9nZXRDYWxsYmFja3Mob3B0cykgOiB7fTtcclxuICAgIHRoaXMucmVjb3JkZWRCbG9icyA9IFtdO1xyXG4gICAgdGhpcy5pZ25vcmVNdXRlZE1lZGlhID0gb3B0cyAmJiB0eXBlb2Yob3B0cy5pZ25vcmVNdXRlZE1lZGlhKSA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5pZ25vcmVNdXRlZE1lZGlhIDogdHJ1ZTtcclxuICAgIFxyXG4gICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIHRoaXMuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgdGhpcy5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHRoaXMuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxufVxyXG5cclxucWJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXMgPSByZXF1aXJlKCcuL21pbWVUeXBlcycpO1xyXG5cclxucWJNZWRpYVJlY29yZGVyLl9TVEFURVMgPSBbJ2luYWN0aXZlJywgJ3JlY29yZGluZycsICdwYXVzZWQnXTtcclxuXHJcbi8qKlxyXG4gKiBJdCBjaGVja3MgY2FwYWJpbGl0eSBvZiByZWNvcmRpbmcgaW4gdGhlIGVudmlyb25tZW50LlxyXG4gKiBDaGVja3MgTWVkaWFSZWNvcmRlciwgTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgYW5kIEJsb2IuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgcWJNZWRpYVJlY29yZGVyIGlzIGF2YWlsYWJsZSBhbmQgY2FuIHJ1biwgb3IgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBpZihxYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gKiAgICAgLy8gLi4uIHNob3cgVUkgZm9yIHJlY29yZGluZ1xyXG4gKiB9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUgPSBmdW5jdGlvbigpe1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiB3aW5kb3cuTWVkaWFSZWNvcmRlciAmJiB0eXBlb2Ygd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkID09PSAnZnVuY3Rpb24nICYmIHdpbmRvdy5CbG9iKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBCb29sZWFuIHdoaWNoIGlzIHRydWUgaWYgdGhlIE1JTUUgdHlwZSBzcGVjaWZpZWQgaXMgb25lIHRoZSB1c2VyIGFnZW50IGNhbiByZWNvcmQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gIG1pbWVUeXBlIC0gVGhlIG1pbWVUeXBlIHRvIGNoZWNrLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICAgIHRydWUgaWYgdGhlIE1lZGlhUmVjb3JkZXIgaW1wbGVtZW50YXRpb24gaXMgY2FwYWJsZSBvZiByZWNvcmRpbmcgQmxvYiBvYmplY3RzIGZvciB0aGUgc3BlY2lmaWVkIE1JTUUgdHlwZS5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQgPSBmdW5jdGlvbihtaW1lVHlwZSkge1xyXG4gICAgaWYoIXFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB3aW5kb3cuTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJuIGFsbCBzdXBwb3J0ZWQgbWltZSB0eXBlcyBhbmQgY29udGFpbmVyIGZvcm1hdC5cclxuICogQHBhcmFtICB7U3RyaW5nfSBbbWltZVR5cGU9dmlkZW9dIFR5cGUgb2YgbWVkaWEuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBzdXBwb3J0ZWQgbWltZXR5cGVzLlJlY29tbWVuZGVkIG1pbWV0eXBlIGhhcyAwIGluZGV4LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgbWltZVR5cGUgPSBxYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKCdhdWRpbycpO1xyXG4gKiBjb25zb2xlLmluZm8oYENhbGwgd2lsbCByZWNvcmRpbmcgaW4gJHttaW1lVHlwZVswXX1gKTtcclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICB2YXIgdHlwZU1lZGlhID0gdHlwZSB8fCAndmlkZW8nO1xyXG5cclxuICAgIGlmKCFxYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcWJNZWRpYVJlY29yZGVyLl9taW1lVHlwZXNbdHlwZU1lZGlhXS5maWx0ZXIoZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgICAgICByZXR1cm4gcWJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChtaW1lVHlwZSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0Q2FsbGJhY2tzID0gZnVuY3Rpb24ob3B0cykge1xyXG4gICAgdmFyIGNhbGxiYWNrcyA9IHt9LFxyXG4gICAgICAgIGNhbGxiYWNrTmFtZXMgPSBbJ29uc3RhcnQnLCAnb25zdG9wJywgJ29ucGF1c2UnLCAnb25yZXN1bWUnLCAnb25lcnJvcicsICdvbmNoYW5nZScsICdvbmRhdGFhdmFpbGFibGUnXTtcclxuXHJcbiAgICBjYWxsYmFja05hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xyXG4gICAgICAgIGlmIChuYW1lIGluIG9wdHMpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2tzW25hbWVdID0gb3B0c1tuYW1lXTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gY2FsbGJhY2tzO1xyXG59XHJcblxyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRNaW1lVHlwZSA9IGZ1bmN0aW9uIChwcmVmZmVyZWQpIHtcclxuICAgIHZhciBtaW1lVHlwZSxcclxuICAgICAgICB0eXBlID0gJ3ZpZGVvJztcclxuXHJcbiAgICBpZihwcmVmZmVyZWQgJiYgcWJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChwcmVmZmVyZWQpKSB7XHJcbiAgICAgICAgbWltZVR5cGUgPSBwcmVmZmVyZWQ7XHJcbiAgICB9IGVsc2UgaWYocHJlZmZlcmVkKSB7XHJcbiAgICAgICAgdHlwZSA9IHByZWZmZXJlZC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYXVkaW8nKSA9PT0gLTEgPyAndmlkZW8nIDogJ2F1ZGlvJztcclxuICAgICAgICBtaW1lVHlwZSA9IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZSlbMF07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1pbWVUeXBlID0gcWJNZWRpYVJlY29yZGVyLmdldFN1cHBvcnRlZE1pbWVUeXBlcyh0eXBlKVswXTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbWltZVR5cGU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gdGhlIGN1cnJlbnQgW3N0YXRlIG9mIHFiTWVkaWFSZWNvcmRlciBpbnN0YW5jZV0oaHR0cHM6Ly93M2MuZ2l0aHViLmlvL21lZGlhY2FwdHVyZS1yZWNvcmQvTWVkaWFSZWNvcmRlci5odG1sI2lkbC1kZWYtcmVjb3JkaW5nc3RhdGUpLlxyXG4gKiBQb3NzaWJseSBzdGF0ZXM6ICoqaW5hY3RpdmUqKiwgKipyZWNvcmRpbmcqKiwgKipwYXVzZWQqKi5cclxuICogQHJldHVybiB7U3RyaW5nfSBOYW1lIG9mIGEgc3RhdGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBxYk1lZGlhUmVjb3JkZXIoKTtcclxuICogLy8gLi4uc29tZSBjb2RlXHJcbiAqXHJcbiAqIGlmKHJlY29yZGVyLmdldFN0YXRlKCkgPT0gJ3JlY29yZGluZycpIHtcclxuICogICAgIGNvbnNvbGUuaW5mbygnWW91IGFyZSBzdGlsbCByZWNvcmRpbmcuJyk7XHJcbiAqIH1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZWRpYVJlY29yZGVyID8gdGhpcy5fbWVkaWFSZWNvcmRlci5zdGF0ZSA6IHFiTWVkaWFSZWNvcmRlci5fU1RBVEVTWzBdO1xyXG59XHJcblxyXG4vKipcclxuICogU3RhcnQgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBGaXJlIHRoZSBtZXRob2QgYHN0b3BgIGlmIGFuIGluc3RhbmNlIGlucHJvZ3Jlc3MgKGhhcyBhIHN0YXRlIHJlY29yZGluZyBvciBwYXVzZWQpLlxyXG4gKiBGaXJlIG9uc3RhcnQgY2FsbGJhY2suXHJcbiAqIEBwYXJhbSB7TWVkaWFTdHJlYW19IHN0cmVhbSAtIFN0cmVhbSBvYmplY3QgcmVwcmVzZW50aW5nIGEgZmx1eCBvZiBhdWRpby0gb3IgdmlkZW8tcmVsYXRlZCBkYXRhLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gc2VsZi5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gcWJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0gfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSBxYk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXSkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHNlbGYuX3N0cmVhbSkge1xyXG4gICAgICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MubGVuZ3RoID0gMDtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtLCBzZWxmLl9vcHRpb25zKTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zLCBlKTtcclxuXHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0pO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuLy8gcWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0RXZlbnRzID0gZnVuY3Rpb24oKSB7XHJcbi8vICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4vLyAgICAgZnVuY3Rpb24gZmlyZUNhbGxiYWNrKG5hbWUsIGFyZ3MpIHtcclxuLy8gICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzW25hbWVdID09PSAnZnVuY3Rpb24nKSB7XHJcbi8vICAgICAgICAgICAgIHRyeSB7XHJcbi8vICAgICAgICAgICAgICAgICBzZWxmLl91c2VyQ2FsbGJhY2tzW25hbWVdKGFyZ3MpO1xyXG4vLyAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuLy8gICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyArIG5hbWUsIGUpO1xyXG4vLyAgICAgICAgICAgICB9XHJcbi8vICAgICAgICAgfVxyXG4vLyAgICAgfVxyXG5cclxuLy8gICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG4vLyAgICAgICAgIGlmKGUuZGF0YSAmJiBlLmRhdGEuc2l6ZSA+IDApIHtcclxuLy8gICAgICAgICAgICAgc2VsZi5fcmVjb3JkZWRDaHVua3MucHVzaChlLmRhdGEpO1xyXG4vLyAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uZGF0YWF2YWlsYWJsZScsIGUpO1xyXG4vLyAgICAgICAgIH1cclxuLy8gICAgIH07XHJcblxyXG4vLyAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbi8vICAgICAgICAgZmlyZUNhbGxiYWNrKCdvblBhdXNlJyk7XHJcbi8vICAgICB9O1xyXG5cclxuLy8gICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuLy8gICAgICAgICBmaXJlQ2FsbGJhY2soJ29uUmVzdW1lJyk7XHJcbi8vICAgICB9O1xyXG5cclxuLy8gICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25lcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XHJcbi8vICAgICAgICAgc3dpdGNoKGVycm9yLm5hbWUpIHtcclxuLy8gICAgICAgICAgICAgY2FzZSAnSW52YWxpZFN0YXRlJzpcclxuLy8gICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuLy8gICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuLy8gICAgICAgICAgICAgY2FzZSAnT3V0T2ZNZW1vcnknOlxyXG4vLyAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4vLyAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4vLyAgICAgICAgICAgICBjYXNlICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzpcclxuLy8gICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuLy8gICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuLy8gICAgICAgICAgICAgY2FzZSAnT3RoZXJSZWNvcmRpbmdFcnJvcic6XHJcbi8vICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbi8vICAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbi8vICAgICAgICAgICAgIGNhc2UgJ0dlbmVyaWNFcnJvcic6XHJcbi8vICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbi8vICAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbi8vICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbi8vICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdNZWRpYVJlY29yZGVyIEVycm9yJywgZXJyb3IpO1xyXG4vLyAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbi8vICAgICAgICAgfVxyXG5cclxuLy8gICAgICAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnaW5hY3RpdmUnICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgIT09ICdzdG9wcGVkJykge1xyXG4vLyAgICAgICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuLy8gICAgICAgICB9XHJcblxyXG4vLyAgICAgICAgIGlmKHNlbGYuX3VzZXJDYWxsYmFja3MgJiYgdHlwZW9mIHNlbGYuX3VzZXJDYWxsYmFja3Mub25FcnJvclJlY29yZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4vLyAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uRXJyb3InLCBlcnJvcik7XHJcbi8vICAgICAgICAgfVxyXG4vLyAgICAgfTtcclxuXHJcbi8vICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4vLyAgICAgICAgIC8vIGNvbnNvbGUuaW5mbygpXHJcbi8vICAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihzZWxmLl9yZWNvcmRlZENodW5rcywge1xyXG4vLyAgICAgICAgICAgICAndHlwZScgOiBzZWxmLl9vcHRpb25zLm1pbWVUeXBlXHJcbi8vICAgICAgICAgfSk7XHJcblxyXG4vLyAgICAgICAgIHNlbGYuX3JlY29yZGVkQmxvYnMucHVzaChibG9iKTtcclxuXHJcbi8vICAgICAgICAgaWYoIXNlbGYuX2tlZXBSZWNvcmRpbmcpIHtcclxuLy8gICAgICAgICAgICAgY29uc29sZS5pbmZvKCdzZWxmLl9yZWNvcmRlZEJsb2JzJywgc2VsZi5fcmVjb3JkZWRCbG9icyk7XHJcblxyXG4vLyAgICAgICAgICAgICBpZihzZWxmLl9yZWNvcmRlZEJsb2JzLmxlbmd0aCA+IDEpIHtcclxuLy8gICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25TdG9wJywgbmV3IEJsb2Ioc2VsZi5fcmVjb3JkZWRCbG9icywge3R5cGU6IHNlbGYuX29wdGlvbnMubWltZVR5cGV9KSk7XHJcbi8vICAgICAgICAgICAgIH0gZWxzZSB7XHJcbi8vICAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uU3RvcCcsIHNlbGYuX3JlY29yZGVkQmxvYnNbMF0pO1xyXG4vLyAgICAgICAgICAgICB9XHJcbi8vICAgICAgICAgfVxyXG5cclxuLy8gICAgICAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gZmFsc2U7XHJcbi8vICAgICB9O1xyXG5cclxuLy8gICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhcnQoc2VsZi5fdGltZVNsaWNlKTtcclxuXHJcbi8vICAgICBmaXJlQ2FsbGJhY2soJ29uU3RhcnQnKTtcclxuLy8gfTtcclxuXHJcblxyXG5cclxuLy8gcWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5jaGFuZ2UgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuLy8gICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbi8vICAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gdHJ1ZTsgLy8gZG9uJ3Qgc3RvcCBhIHJlY29yZFxyXG4vLyAgICAgc2VsZi5zdG9wKCk7XHJcblxyXG4vLyAgICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbi8vICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblxyXG4vLyAgICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG4vLyAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHNlbGYuX29wdGlvbnMpO1xyXG4vLyAgICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbi8vIH07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbi8vIHFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4vLyAgICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4vLyAgICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuLy8gICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJyl7XHJcbi8vICAgICAgICAgbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbi8vICAgICB9IGVsc2Uge1xyXG4vLyAgICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuLy8gICAgIH1cclxuLy8gfTtcclxuXHJcbi8qKlxyXG4gKiBQYXVzZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuLy8gcWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4vLyAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuLy8gICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuLy8gICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcbi8vICAgICB9IGVsc2Uge1xyXG4vLyAgICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuLy8gICAgIH1cclxuLy8gfTtcclxuXHJcbi8qKlxyXG4gKiBSZXN1bWUgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcbi8vIHFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbi8vICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4vLyAgICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4vLyAgICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbi8vICAgICB9IGVsc2Uge1xyXG4vLyAgICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuLy8gICAgIH1cclxuLy8gfTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBmaWxlIGZyb20gYmxvYiBhbmQgZG93bmxvYWQgYXMgdGhlIGZpbGUuIEl0cyBtZXRob2Qgd2lsbCBmaXJlICdzdG9wJyBpZiByZWNvcmRpbmcgaW4gcHJvZ3Jlc3MuXHJcbiAqIEBwYXJhbSAge1N0cmludH0gZmlsZU5hbWUgTmFtZSBvZiBmaWxlLiBZb3UgY2FuIHNldCBgZmFsc2VgIGFuZCB3ZSBhcmUgZ2VuZXJhdGUgbmFtZSBvZiBmaWxlIGJhc2VkIG9uIERhdGUubm93KCkuXHJcbiAqIEBwYXJhbSAge0Jsb2J9ICAgYmxvYiAgICAgWW91IGNhbiBzZXQgYmxvYiB3aGljaCB5b3UgZ2V0IGZyb20gdGhlIG1ldGhvZCBgc3RvcGAgb3IgZG9uJ3Qgc2V0IGFueXRoaW5nIGFuZFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHdlIHdpbGwgZ2V0IHJlY29yZGVkIGNodW5ja3MuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxuLy8gcWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5kb3dubG9hZCA9IGZ1bmN0aW9uKGZpbGVOYW1lLCBibG9iKSB7XHJcbi8vICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4vLyAgICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4vLyAgICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuLy8gICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4vLyAgICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4vLyAgICAgfVxyXG5cclxuLy8gICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4vLyAgICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4vLyAgICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4vLyAgICAgYS5ocmVmID0gdXJsO1xyXG4vLyAgICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuLy8gICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4vLyAgICAgLyogU3RhcnQgZG93bG9hZGluZyAqL1xyXG4vLyAgICAgYS5jbGljaygpO1xyXG4gICAgXHJcbi8vICAgICAvKiBSZW1vdmUgbGluayAqL1xyXG4vLyAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuLy8gICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4vLyAgICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbi8vICAgICB9LCAxMDApO1xyXG4vLyB9O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIC0gUmVjb3JkZWQgZGF0YS5cclxuICogQHJldHVybiB7T2JqZWN0fSAtIEJsb2Igb2YgcmVjb3JkZWQgbWVkaWEgb3Igd2hhdCB5b3Ugc2V0IGluIGRhdGFcclxuICovXHJcbi8vIHFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEJsb2JSZWNvcmRlZCA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuLy8gICAgIHZhciBzZWxmID0gdGhpcyxcclxuLy8gICAgICAgICBjaHVua3MgPSBkYXRhIHx8IHNlbGYuX3JlY29yZGVkQ2h1bmtzO1xyXG5cclxuLy8gICAgIGlmKCFjaHVua3MubGVuZ3RoKSB7XHJcbi8vICAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5ub19yZWNvcmRlZF9jaHVua3MpO1xyXG4vLyAgICAgICAgIHJldHVybiBmYWxzZTtcclxuLy8gICAgIH1cclxuXHJcbi8vICAgICByZXR1cm4gbmV3IEJsb2IoY2h1bmtzLCB7ICd0eXBlJyA6IHNlbGYuX29wdGlvbnMubWltZVR5cGUgfSk7XHJcbi8vIH07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGEgZXh0ZW5zaW9uIG9mIGEgZmlsZS4gQmFzZWQgb24gYXZhaWxhYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxuLy8gcWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbi8vICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4vLyAgICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4vLyAgICAgICAgIGV4dGVuc2lvbiA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4vLyAgICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4vLyAgICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4vLyAgICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuLy8gICAgIH1cclxuXHJcbi8vICAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG4vLyB9O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxYk1lZGlhUmVjb3JkZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ2F1ZGlvJzogW1xyXG4gICAgICAgICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyxcclxuICAgICAgICAnYXVkaW8vd2VibScsXHJcbiAgICAgICAgJ2F1ZGlvL29nZydcclxuICAgIF0sXHJcbiAgICAndmlkZW8nOiBbXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWgyNjQnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1kYWFsYScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59OyJdfQ==
