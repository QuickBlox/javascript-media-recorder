(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Last time updated at May 23, 2015, 08:32:23

// Latest file can be found here: https://cdn.webrtc-experiment.com/ConcatenateBlobs.js

// Muaz Khan    - www.MuazKhan.com
// MIT License  - www.WebRTC-Experiment.com/licence
// Source Code  - https://github.com/muaz-khan/ConcatenateBlobs
// Demo         - https://www.WebRTC-Experiment.com/ConcatenateBlobs/

// ___________________
// ConcatenateBlobs.js

// Simply pass array of blobs.
// This javascript library will concatenate all blobs in single "Blob" object.

function ConcatenateBlobs (blobs, type, callback) {
    var buffers = [];

    var index = 0;

    function readAsArrayBuffer() {
        if (!blobs[index]) {
            return concatenateBuffers();
        }
        var reader = new FileReader();
        reader.onload = function(event) {
            buffers.push(event.target.result);
            index++;
            readAsArrayBuffer();
        };
        reader.readAsArrayBuffer(blobs[index]);
    }

    readAsArrayBuffer();

    function concatenateBuffers() {
        var byteLength = 0;
        buffers.forEach(function(buffer) {
            byteLength += buffer.byteLength;
        });
        
        var tmp = new Uint16Array(byteLength);
        var lastOffset = 0;
        buffers.forEach(function(buffer) {
            // BYTES_PER_ELEMENT == 2 for Uint16Array
            var reusableByteLength = buffer.byteLength;
            if (reusableByteLength % 2 != 0) {
                buffer = buffer.slice(0, reusableByteLength - 1)
            }
            tmp.set(new Uint16Array(buffer), lastOffset);
            lastOffset += reusableByteLength;
        });

        var blob = new Blob([tmp.buffer], {
            type: type
        });

        callback(blob);
    }
}

module.exports = ConcatenateBlobs;

},{}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
'use strict';

var ERRORS = require('./errors');

/**
 * @constructor qbMediaRecorder
 * @param {Object}  [opts] - Object of parameters.
 * @param {String}      [opts.mimeType = 'video'] - Set mime type of record media or only type of media: 'video'/'audio'. By default if 'video'
 * @param {Number}      [opts.timeSlice = 1000] - A timeslice argument with a value in milliseconds (fire 'ondataavaible' callback).
 * @param {Boolean}     [opts.ignoreMutedMedia = true] - What to do with a muted input MediaStreamTrack, e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 * @param {Object}      [opts.callbacks] - Object of callbacks.
 * @param {Function}        [opts.callbacks.onStart] - Callback when recording is started.
 * @param {Function}        [opts.callbacks.onError] - Callback when recording is failed.
 * @param {Function}        [opts.callbacks.onPause] - Callback when recording is paused.
 * @param {Function}        [opts.callbacks.onResume] - Callback when recording is stoped.
 * @param {Function}        [opts.callbacks.onStop] - Callback when recording is stoped.
 * @param {Function}        [opts.callbacks.ondataavailable] - Slice a blob by timeSlice and return event object.
 */
function qbMediaRecorder(opts) {
    var self = this;

    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    self._stream = null;
    self._mediaRecorder = null;
    self._recordedChunks = [];
    self._recordedBlobs = [];
    self._keepRecording = false; // uses for method change(stream)

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
 * @access private
 * 
 * All available mime types in a browser environment.
 * @type {Object}
 */
qbMediaRecorder._mimeTypes = require('./mimeTypes');

qbMediaRecorder._concatBlobs = require('./concatBlobs');

/**
 * It checks capability of recording in the current environment.
 * @return {Boolean} Returns true if the qbMediaRecorder is available and can run, or false otherwise.
 */
qbMediaRecorder.isAvailable = function(){
    return !!(window && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function');
};

/**
 * Checking all mime types for support in browser enviroment. Recommended mime type has 0 index.
 * 
 * @param  {string} prefferedTypeMedia 'audio' or 'video'. What type of media you want to check support.
 *                                     By default is 'video'.
 * @return {array}                     Array of supported mimetypes.
 */
qbMediaRecorder.getSupportedMimeTypes = function(prefferedTypeMedia) {
    var typeMedia = prefferedTypeMedia || 'video';

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

qbMediaRecorder.prototype._setEvents = function() {
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

    self._mediaRecorder.ondataavailable = function(e) {
        if(e.data && e.data.size > 0) {
            self._recordedChunks.push(e.data);
            fireCallback('ondataavailable', e);
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

    self._mediaRecorder.onstop = function() {
        // console.info()
        var blob = new Blob(self._recordedChunks, {
            'type' : self._options.mimeType
        });

        self._recordedBlobs.push(blob);

        if(!self._keepRecording) {
            console.info('self._recordedBlobs', self._recordedBlobs);

            if(self._recordedBlobs.length > 1) {
                fireCallback('onStop', new Blob(self._recordedBlobs, {type: self._options.mimeType}));
            } else {
                fireCallback('onStop', self._recordedBlobs[0]);
            }
        }

        self._keepRecording = false;
    };

    self._mediaRecorder.start(self._timeSlice);

    fireCallback('onStart');
};

/**
 * Start to recording a stream.
 * Fire the method `stop` if record has state `inprogress`.
 * @param {Object} [stream] - Stream object representing a flux of audio- or video-related data.
 * @returns {void}
 */
qbMediaRecorder.prototype.start = function(stream) {
    var self = this;

    var mediaRecorderState = self.getState();

    if(mediaRecorderState === 'recording' || mediaRecorderState === 'paused'){
        self._mediaRecorder.stop();
    }

    if(self._stream) {
        self._stream = null;
    }

    self._stream = stream;

    /* Clear data from previously recording */ 
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

qbMediaRecorder.prototype.change = function(stream) {
    var self = this;

    self._keepRecording = true; // don't stop a record
    self.stop();

     self._stream = null;
     self._mediaRecorder = null;

    self._stream = stream;
    self._mediaRecorder = new window.MediaRecorder(self._stream, self._options);
    self._setEvents();
};

/**
 * Stop to recording a stream.
 * @return {Blob} Blob of recorded chuncks.
 */
qbMediaRecorder.prototype.stop = function() {
    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

    if(mediaRecorder && mediaRecorderState === 'recording'){
        mediaRecorder.stop();
    } else {
        console.warn(ERRORS.actionFailed);
    }
};

/**
 * Pause to recording a stream.
 * @returns {void}
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
 * @returns {void}
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
 * @param  {Strint} fileName Name of file. You can set `false` and we are generate name of file based on Date.now().
 * @param  {Blob}   blob     You can set blob which you get from the method `stop` or don't set anything and
 *                           we will get recorded chuncks.
 * @returns {void}
 */
qbMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var mediaRecorder = this._mediaRecorder,
        mediaRecorderState = mediaRecorder && mediaRecorder.state ? mediaRecorder.state : 'inactive';

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
 * @param {Object} [data] - Recorded data.
 * @return {Object} - Blob of recorded media or what you set in data
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
 * Return a extension of a file. Based on available mimeType.
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

},{"./concatBlobs":1,"./errors":2,"./mimeTypes":4}],4:[function(require,module,exports){
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
},{}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29uY2F0QmxvYnMuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIExhc3QgdGltZSB1cGRhdGVkIGF0IE1heSAyMywgMjAxNSwgMDg6MzI6MjNcclxuXHJcbi8vIExhdGVzdCBmaWxlIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwczovL2Nkbi53ZWJydGMtZXhwZXJpbWVudC5jb20vQ29uY2F0ZW5hdGVCbG9icy5qc1xyXG5cclxuLy8gTXVheiBLaGFuICAgIC0gd3d3Lk11YXpLaGFuLmNvbVxyXG4vLyBNSVQgTGljZW5zZSAgLSB3d3cuV2ViUlRDLUV4cGVyaW1lbnQuY29tL2xpY2VuY2VcclxuLy8gU291cmNlIENvZGUgIC0gaHR0cHM6Ly9naXRodWIuY29tL211YXota2hhbi9Db25jYXRlbmF0ZUJsb2JzXHJcbi8vIERlbW8gICAgICAgICAtIGh0dHBzOi8vd3d3LldlYlJUQy1FeHBlcmltZW50LmNvbS9Db25jYXRlbmF0ZUJsb2JzL1xyXG5cclxuLy8gX19fX19fX19fX19fX19fX19fX1xyXG4vLyBDb25jYXRlbmF0ZUJsb2JzLmpzXHJcblxyXG4vLyBTaW1wbHkgcGFzcyBhcnJheSBvZiBibG9icy5cclxuLy8gVGhpcyBqYXZhc2NyaXB0IGxpYnJhcnkgd2lsbCBjb25jYXRlbmF0ZSBhbGwgYmxvYnMgaW4gc2luZ2xlIFwiQmxvYlwiIG9iamVjdC5cclxuXHJcbmZ1bmN0aW9uIENvbmNhdGVuYXRlQmxvYnMgKGJsb2JzLCB0eXBlLCBjYWxsYmFjaykge1xyXG4gICAgdmFyIGJ1ZmZlcnMgPSBbXTtcclxuXHJcbiAgICB2YXIgaW5kZXggPSAwO1xyXG5cclxuICAgIGZ1bmN0aW9uIHJlYWRBc0FycmF5QnVmZmVyKCkge1xyXG4gICAgICAgIGlmICghYmxvYnNbaW5kZXhdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb25jYXRlbmF0ZUJ1ZmZlcnMoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcbiAgICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgICAgIGJ1ZmZlcnMucHVzaChldmVudC50YXJnZXQucmVzdWx0KTtcclxuICAgICAgICAgICAgaW5kZXgrKztcclxuICAgICAgICAgICAgcmVhZEFzQXJyYXlCdWZmZXIoKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9ic1tpbmRleF0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJlYWRBc0FycmF5QnVmZmVyKCk7XHJcblxyXG4gICAgZnVuY3Rpb24gY29uY2F0ZW5hdGVCdWZmZXJzKCkge1xyXG4gICAgICAgIHZhciBieXRlTGVuZ3RoID0gMDtcclxuICAgICAgICBidWZmZXJzLmZvckVhY2goZnVuY3Rpb24oYnVmZmVyKSB7XHJcbiAgICAgICAgICAgIGJ5dGVMZW5ndGggKz0gYnVmZmVyLmJ5dGVMZW5ndGg7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRtcCA9IG5ldyBVaW50MTZBcnJheShieXRlTGVuZ3RoKTtcclxuICAgICAgICB2YXIgbGFzdE9mZnNldCA9IDA7XHJcbiAgICAgICAgYnVmZmVycy5mb3JFYWNoKGZ1bmN0aW9uKGJ1ZmZlcikge1xyXG4gICAgICAgICAgICAvLyBCWVRFU19QRVJfRUxFTUVOVCA9PSAyIGZvciBVaW50MTZBcnJheVxyXG4gICAgICAgICAgICB2YXIgcmV1c2FibGVCeXRlTGVuZ3RoID0gYnVmZmVyLmJ5dGVMZW5ndGg7XHJcbiAgICAgICAgICAgIGlmIChyZXVzYWJsZUJ5dGVMZW5ndGggJSAyICE9IDApIHtcclxuICAgICAgICAgICAgICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZSgwLCByZXVzYWJsZUJ5dGVMZW5ndGggLSAxKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRtcC5zZXQobmV3IFVpbnQxNkFycmF5KGJ1ZmZlciksIGxhc3RPZmZzZXQpO1xyXG4gICAgICAgICAgICBsYXN0T2Zmc2V0ICs9IHJldXNhYmxlQnl0ZUxlbmd0aDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYihbdG1wLmJ1ZmZlcl0sIHtcclxuICAgICAgICAgICAgdHlwZTogdHlwZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjYWxsYmFjayhibG9iKTtcclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb25jYXRlbmF0ZUJsb2JzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgICd1bnN1cHBvcnQnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBzdXBwb3J0ZWQgdGhpcyBlbnZpcm9ubWVudC4nLFxyXG4gICAgJ3Vuc3VwcG9ydE1lZGlhUmVjb3JkZXJXaXRoT3B0aW9ucyc6ICdHb3QgYSB3YXJuaW5nIHdoZW4gY3JlYXRpbmcgYSBNZWRpYVJlY29yZGVyLCB0cnlpbmcgdG8gY3JlYXRlIE1lZGlhUmVjb3JkZXIgd2l0aG91dCBvcHRpb25zLicsXHJcbiAgICAnY2FsbGJhY2tFcnJvcic6ICdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicsXHJcbiAgICAnYWN0aW9uRmFpbGVkJzogJ3FiTWVkaWFSZWNvcmRlciBpcyBub3QgY3JlYXRlZCBvciBoYXMgYW4gaW52YWxpZCBzdGF0ZS4nLFxyXG4gICAgJ25vX3JlY29yZGVkX2NodW5rcyc6ICdEb2VzIG5vdCBoYXZlIGFueSByZWNvcmRpbmcgZGF0YS4nLFxyXG4gICAgJ3N0cmVhbVJlcXVpcmVkJzogJ01lZGlhU3RyZWFtIGlzIHJlcXVpcmVkLicsXHJcbiAgICAnSW52YWxpZFN0YXRlJzogJ3FiTWVkaWFSZWNvcmRlciBpcyBub3QgaW4gYSBzdGF0ZSBpbiB3aGljaCB0aGUgcHJvcG9zZWQgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG8gYmUgZXhlY3V0ZWQuJyxcclxuICAgICdPdXRPZk1lbW9yeSc6ICdUaGUgVUEgaGFzIGV4aGF1c2VkIHRoZSBhdmFpbGFibGUgbWVtb3J5LiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6ICdBIG1vZGlmaWNhdGlvbiB0byB0aGUgc3RyZWFtIGhhcyBvY2N1cnJlZCB0aGF0IG1ha2VzIGl0IGltcG9zc2libGUgdG8gY29udGludWUgcmVjb3JkaW5nLiBBbiBleGFtcGxlIHdvdWxkIGJlIHRoZSBhZGRpdGlvbiBvZiBhIFRyYWNrIHdoaWxlIHJlY29yZGluZyBpcyBvY2N1cnJpbmcuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdPdGhlclJlY29yZGluZ0Vycm9yJzogJ1VzZWQgZm9yIGFuIGZhdGFsIGVycm9yIG90aGVyIHRoYW4gdGhvc2UgbGlzdGVkIGFib3ZlLiBVc2VyIGFnZW50cyBTSE9VTEQgcHJvdmlkZSBhcyBtdWNoIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYXMgcG9zc2libGUgaW4gdGhlIG1lc3NhZ2UgYXR0cmlidXRlLicsXHJcbiAgICAnR2VuZXJpY0Vycm9yJzogJ1RoZSBVQSBjYW5ub3QgcHJvdmlkZSB0aGUgY29kZWMgb3IgcmVjb3JkaW5nIG9wdGlvbiB0aGF0IGhhcyBiZWVuIHJlcXVlc3RlZCdcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRVJST1JTID0gcmVxdWlyZSgnLi9lcnJvcnMnKTtcclxuXHJcbi8qKlxyXG4gKiBAY29uc3RydWN0b3IgcWJNZWRpYVJlY29yZGVyXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdHNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIFtvcHRzLm1pbWVUeXBlID0gJ3ZpZGVvJ10gLSBTZXQgbWltZSB0eXBlIG9mIHJlY29yZCBtZWRpYSBvciBvbmx5IHR5cGUgb2YgbWVkaWE6ICd2aWRlbycvJ2F1ZGlvJy4gQnkgZGVmYXVsdCBpZiAndmlkZW8nXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSAgICAgIFtvcHRzLnRpbWVTbGljZSA9IDEwMDBdIC0gQSB0aW1lc2xpY2UgYXJndW1lbnQgd2l0aCBhIHZhbHVlIGluIG1pbGxpc2Vjb25kcyAoZmlyZSAnb25kYXRhYXZhaWJsZScgY2FsbGJhY2spLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59ICAgICBbb3B0cy5pZ25vcmVNdXRlZE1lZGlhID0gdHJ1ZV0gLSBXaGF0IHRvIGRvIHdpdGggYSBtdXRlZCBpbnB1dCBNZWRpYVN0cmVhbVRyYWNrLCBlLmcuIGluc2VydCBibGFjayBmcmFtZXMvemVybyBhdWRpbyB2b2x1bWUgaW4gdGhlIHJlY29yZGluZyBvciBpZ25vcmUgYWx0b2dldGhlci5cclxuICogQHBhcmFtIHtPYmplY3R9ICAgICAgW29wdHMuY2FsbGJhY2tzXSAtIE9iamVjdCBvZiBjYWxsYmFja3MuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259ICAgICAgICBbb3B0cy5jYWxsYmFja3Mub25TdGFydF0gLSBDYWxsYmFjayB3aGVuIHJlY29yZGluZyBpcyBzdGFydGVkLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICAgICAgW29wdHMuY2FsbGJhY2tzLm9uRXJyb3JdIC0gQ2FsbGJhY2sgd2hlbiByZWNvcmRpbmcgaXMgZmFpbGVkLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICAgICAgW29wdHMuY2FsbGJhY2tzLm9uUGF1c2VdIC0gQ2FsbGJhY2sgd2hlbiByZWNvcmRpbmcgaXMgcGF1c2VkLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICAgICAgW29wdHMuY2FsbGJhY2tzLm9uUmVzdW1lXSAtIENhbGxiYWNrIHdoZW4gcmVjb3JkaW5nIGlzIHN0b3BlZC5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gICAgICAgIFtvcHRzLmNhbGxiYWNrcy5vblN0b3BdIC0gQ2FsbGJhY2sgd2hlbiByZWNvcmRpbmcgaXMgc3RvcGVkLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICAgICAgW29wdHMuY2FsbGJhY2tzLm9uZGF0YWF2YWlsYWJsZV0gLSBTbGljZSBhIGJsb2IgYnkgdGltZVNsaWNlIGFuZCByZXR1cm4gZXZlbnQgb2JqZWN0LlxyXG4gKi9cclxuZnVuY3Rpb24gcWJNZWRpYVJlY29yZGVyKG9wdHMpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gbnVsbDtcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHNlbGYuX3JlY29yZGVkQmxvYnMgPSBbXTtcclxuICAgIHNlbGYuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTsgLy8gdXNlcyBmb3IgbWV0aG9kIGNoYW5nZShzdHJlYW0pXHJcblxyXG4gICAgc2VsZi5fdGltZVNsaWNlID0gb3B0cyAmJiBvcHRzLnRpbWVTbGljZSA/IG9wdHMudGltZVNsaWNlIDogMTAwMDtcclxuICAgIHNlbGYuX3VzZXJDYWxsYmFja3MgPSBvcHRzICYmIG9wdHMuY2FsbGJhY2tzID8gb3B0cy5jYWxsYmFja3MgOiBudWxsOyBcclxuXHJcbiAgICB2YXIgdHlwZU1lZGlhUmVjb3JkZWQgPSAndmlkZW8nLCAvLyBieSBkZWZhdWx0XHJcbiAgICAgICAgcHJlZmZlcmVkTWltZVR5cGUgPSBvcHRzICYmIG9wdHMubWltZVR5cGU7XHJcblxyXG4gICAgaWYocHJlZmZlcmVkTWltZVR5cGUpIHtcclxuICAgICAgICB0eXBlTWVkaWFSZWNvcmRlZCA9IHByZWZmZXJlZE1pbWVUeXBlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhdWRpbycpID09PSAtMSA/ICd2aWRlbycgOiAnYXVkaW8nO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX29wdGlvbnMgPSB7XHJcbiAgICAgICAgbWltZVR5cGU6IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZU1lZGlhUmVjb3JkZWQsIHByZWZmZXJlZE1pbWVUeXBlKVswXSxcclxuICAgICAgICBpZ25vcmVNdXRlZE1lZGlhOiBvcHRzICYmIHR5cGVvZiBvcHRzLmlnbm9yZU11dGVkTWVkaWEgIT09IHVuZGVmaW5lZCA/IG9wdHMuaWdub3JlTXV0ZWRNZWRpYSA6IHRydWVcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogXHJcbiAqIEFsbCBhdmFpbGFibGUgbWltZSB0eXBlcyBpbiBhIGJyb3dzZXIgZW52aXJvbm1lbnQuXHJcbiAqIEB0eXBlIHtPYmplY3R9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuX21pbWVUeXBlcyA9IHJlcXVpcmUoJy4vbWltZVR5cGVzJyk7XHJcblxyXG5xYk1lZGlhUmVjb3JkZXIuX2NvbmNhdEJsb2JzID0gcmVxdWlyZSgnLi9jb25jYXRCbG9icycpO1xyXG5cclxuLyoqXHJcbiAqIEl0IGNoZWNrcyBjYXBhYmlsaXR5IG9mIHJlY29yZGluZyBpbiB0aGUgY3VycmVudCBlbnZpcm9ubWVudC5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBxYk1lZGlhUmVjb3JkZXIgaXMgYXZhaWxhYmxlIGFuZCBjYW4gcnVuLCBvciBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUgPSBmdW5jdGlvbigpe1xyXG4gICAgcmV0dXJuICEhKHdpbmRvdyAmJiB3aW5kb3cuTWVkaWFSZWNvcmRlciAmJiB0eXBlb2Ygd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkID09PSAnZnVuY3Rpb24nKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja2luZyBhbGwgbWltZSB0eXBlcyBmb3Igc3VwcG9ydCBpbiBicm93c2VyIGVudmlyb21lbnQuIFJlY29tbWVuZGVkIG1pbWUgdHlwZSBoYXMgMCBpbmRleC5cclxuICogXHJcbiAqIEBwYXJhbSAge3N0cmluZ30gcHJlZmZlcmVkVHlwZU1lZGlhICdhdWRpbycgb3IgJ3ZpZGVvJy4gV2hhdCB0eXBlIG9mIG1lZGlhIHlvdSB3YW50IHRvIGNoZWNrIHN1cHBvcnQuXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5IGRlZmF1bHQgaXMgJ3ZpZGVvJy5cclxuICogQHJldHVybiB7YXJyYXl9ICAgICAgICAgICAgICAgICAgICAgQXJyYXkgb2Ygc3VwcG9ydGVkIG1pbWV0eXBlcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMgPSBmdW5jdGlvbihwcmVmZmVyZWRUeXBlTWVkaWEpIHtcclxuICAgIHZhciB0eXBlTWVkaWEgPSBwcmVmZmVyZWRUeXBlTWVkaWEgfHwgJ3ZpZGVvJztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHFiTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzW3R5cGVNZWRpYV0uZmlsdGVyKGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZChtaW1lVHlwZSk7XHJcbiAgICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gYSBbc3RhdGUgb2YgcmVjb3JkaW5nXShodHRwczovL3czYy5naXRodWIuaW8vbWVkaWFjYXB0dXJlLXJlY29yZC9NZWRpYVJlY29yZGVyLmh0bWwjaWRsLWRlZi1yZWNvcmRpbmdzdGF0ZSkuXHJcbiAqIFBvc3NpYmx5IHN0YXRlczogKippbmFjdGl2ZSoqLCAqKnJlY29yZGluZyoqLCAqKnBhdXNlZCoqXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gTmFtZSBvZiBhIHN0YXRlLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX21lZGlhUmVjb3JkZXIgPyB0aGlzLl9tZWRpYVJlY29yZGVyLnN0YXRlIDogJ2luYWN0aXZlJztcclxufTtcclxuXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX3NldEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpcmVDYWxsYmFjayhuYW1lLCBhcmdzKSB7XHJcbiAgICAgICAgaWYoc2VsZi5fdXNlckNhbGxiYWNrcyAmJiB0eXBlb2Ygc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5fdXNlckNhbGxiYWNrc1tuYW1lXShhcmdzKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicgKyBuYW1lLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZihlLmRhdGEgJiYgZS5kYXRhLnNpemUgPiAwKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLnB1c2goZS5kYXRhKTtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmRhdGFhdmFpbGFibGUnLCBlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25QYXVzZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvblJlc3VtZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgIHN3aXRjaChlcnJvci5uYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ0ludmFsaWRTdGF0ZSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ091dE9mTWVtb3J5JzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ090aGVyUmVjb3JkaW5nRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdHZW5lcmljRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTWVkaWFSZWNvcmRlciBFcnJvcicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJyAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnc3RvcHBlZCcpIHtcclxuICAgICAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbkVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyBjb25zb2xlLmluZm8oKVxyXG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2Ioc2VsZi5fcmVjb3JkZWRDaHVua3MsIHtcclxuICAgICAgICAgICAgJ3R5cGUnIDogc2VsZi5fb3B0aW9ucy5taW1lVHlwZVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBzZWxmLl9yZWNvcmRlZEJsb2JzLnB1c2goYmxvYik7XHJcblxyXG4gICAgICAgIGlmKCFzZWxmLl9rZWVwUmVjb3JkaW5nKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbygnc2VsZi5fcmVjb3JkZWRCbG9icycsIHNlbGYuX3JlY29yZGVkQmxvYnMpO1xyXG5cclxuICAgICAgICAgICAgaWYoc2VsZi5fcmVjb3JkZWRCbG9icy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBmaXJlQ2FsbGJhY2soJ29uU3RvcCcsIG5ldyBCbG9iKHNlbGYuX3JlY29yZGVkQmxvYnMsIHt0eXBlOiBzZWxmLl9vcHRpb25zLm1pbWVUeXBlfSkpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvblN0b3AnLCBzZWxmLl9yZWNvcmRlZEJsb2JzWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KHNlbGYuX3RpbWVTbGljZSk7XHJcblxyXG4gICAgZmlyZUNhbGxiYWNrKCdvblN0YXJ0Jyk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RhcnQgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBGaXJlIHRoZSBtZXRob2QgYHN0b3BgIGlmIHJlY29yZCBoYXMgc3RhdGUgYGlucHJvZ3Jlc3NgLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gW3N0cmVhbV0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IHNlbGYuZ2V0U3RhdGUoKTtcclxuXHJcbiAgICBpZihtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnIHx8IG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gJ3BhdXNlZCcpe1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHNlbGYuX3N0cmVhbSkge1xyXG4gICAgICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG5cclxuICAgIC8qIENsZWFyIGRhdGEgZnJvbSBwcmV2aW91c2x5IHJlY29yZGluZyAqLyBcclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgc2VsZi5fcmVjb3JkZWRDaHVua3MubGVuZ3RoID0gMDtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIgPSBuZXcgd2luZG93Lk1lZGlhUmVjb3JkZXIoc2VsZi5fc3RyZWFtLCBzZWxmLl9vcHRpb25zKTtcclxuICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMudW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zLCBlKTtcclxuXHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0pO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5jaGFuZ2UgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBzZWxmLl9rZWVwUmVjb3JkaW5nID0gdHJ1ZTsgLy8gZG9uJ3Qgc3RvcCBhIHJlY29yZFxyXG4gICAgc2VsZi5zdG9wKCk7XHJcblxyXG4gICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbiAgICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG5ldyB3aW5kb3cuTWVkaWFSZWNvcmRlcihzZWxmLl9zdHJlYW0sIHNlbGYuX29wdGlvbnMpO1xyXG4gICAgc2VsZi5fc2V0RXZlbnRzKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3RvcCB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm4ge0Jsb2J9IEJsb2Igb2YgcmVjb3JkZWQgY2h1bmNrcy5cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJyl7XHJcbiAgICAgICAgbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBQYXVzZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGlmKHNlbGYuX21lZGlhUmVjb3JkZXIgJiYgc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSA9PT0gJ3JlY29yZGluZycpIHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnBhdXNlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXN1bWUgdG8gcmVjb3JkaW5nIGEgc3RyZWFtLlxyXG4gKiBAcmV0dXJucyB7dm9pZH1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncGF1c2VkJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucmVzdW1lKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihFUlJPUlMuYWN0aW9uRmFpbGVkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBmaWxlIGZyb20gYmxvYiBhbmQgZG93bmxvYWQgYXMgdGhlIGZpbGUuIEl0cyBtZXRob2Qgd2lsbCBmaXJlICdzdG9wJyBpZiByZWNvcmRpbmcgaW4gcHJvZ3Jlc3MuXHJcbiAqIEBwYXJhbSAge1N0cmludH0gZmlsZU5hbWUgTmFtZSBvZiBmaWxlLiBZb3UgY2FuIHNldCBgZmFsc2VgIGFuZCB3ZSBhcmUgZ2VuZXJhdGUgbmFtZSBvZiBmaWxlIGJhc2VkIG9uIERhdGUubm93KCkuXHJcbiAqIEBwYXJhbSAge0Jsb2J9ICAgYmxvYiAgICAgWW91IGNhbiBzZXQgYmxvYiB3aGljaCB5b3UgZ2V0IGZyb20gdGhlIG1ldGhvZCBgc3RvcGAgb3IgZG9uJ3Qgc2V0IGFueXRoaW5nIGFuZFxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHdlIHdpbGwgZ2V0IHJlY29yZGVkIGNodW5ja3MuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5kb3dubG9hZCA9IGZ1bmN0aW9uKGZpbGVOYW1lLCBibG9iKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIG1lZGlhUmVjb3JkZXIgPSB0aGlzLl9tZWRpYVJlY29yZGVyLFxyXG4gICAgICAgIG1lZGlhUmVjb3JkZXJTdGF0ZSA9IG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlci5zdGF0ZSA/IG1lZGlhUmVjb3JkZXIuc3RhdGUgOiAnaW5hY3RpdmUnO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXIgJiYgbWVkaWFSZWNvcmRlclN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIG1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLyogU3RhcnQgZG93bG9hZGluZyAqL1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgXHJcbiAgICAvKiBSZW1vdmUgbGluayAqL1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIC0gUmVjb3JkZWQgZGF0YS5cclxuICogQHJldHVybiB7T2JqZWN0fSAtIEJsb2Igb2YgcmVjb3JkZWQgbWVkaWEgb3Igd2hhdCB5b3Ugc2V0IGluIGRhdGFcclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEJsb2JSZWNvcmRlZCA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBjaHVua3MgPSBkYXRhIHx8IHNlbGYuX3JlY29yZGVkQ2h1bmtzO1xyXG5cclxuICAgIGlmKCFjaHVua3MubGVuZ3RoKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5ub19yZWNvcmRlZF9jaHVua3MpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IEJsb2IoY2h1bmtzLCB7ICd0eXBlJyA6IHNlbGYuX29wdGlvbnMubWltZVR5cGUgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGEgZXh0ZW5zaW9uIG9mIGEgZmlsZS4gQmFzZWQgb24gYXZhaWxhYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYuX29wdGlvbnMubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxYk1lZGlhUmVjb3JkZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ2F1ZGlvJzogW1xyXG4gICAgICAgICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyxcclxuICAgICAgICAnYXVkaW8vd2VibScsXHJcbiAgICAgICAgJ2F1ZGlvL29nZydcclxuICAgIF0sXHJcbiAgICAndmlkZW8nOiBbXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWgyNjQnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1kYWFsYScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59OyJdfQ==
