(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.qbMediaRecorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = {
    'unsupport': 'qbMediaRecorder is not supported this environment.',
    'unsupportMediaRecorderWithOptions': 'Got a warning when creating a MediaRecorder, trying to create MediaRecorder without options.',
    'requreArgument': '1 argument required, but only 0 present.',
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
 * @param {Object}   [opts] - Object of parameters.
 * @param {String}   opts[].mimeType=video - Specifies the media type and container format for the recording. You can set simply: 'video' or 'audio' or 'audio/webm';
 * @param {Number}   opts[].timeslice=1000 - The minimum number of milliseconds of data to return in a single Blob, fire 'ondataavaible' callback.
 * @param {Boolean}  opts[].ignoreMutedMedia=true - What to do with a muted input MediaStreamTrack, e.g. insert black frames/zero audio volume in the recording or ignore altogether.
 * @param {Function} opts[].onstart - Called to handle the start event.
 * @param {Function} opts[].onstop - Called to handle the stop event.
 * @param {Function} opts[].onpause - Called to handle the pause event.
 * @param {Function} opts[].onresume - Called to handle the resume event.
 * @param {Function} opts[].onerror - Called to handle an ErrorEvent.
 * @param {Function} opts[].onchange - Called to handle the change a stream event.
 * @param {Function} opts[].ondataavailable - Called to handle the dataavailable event. The Blob of recorded data is contained in this event.
 *
 * @example
 * var opts = {
 *     onstart: function onStart() { // Use named function.
 *         console.log('Recorder is started');
 *     },
 *     onstop: function onStop(Blob) {
 *         videoElement.src = URL.createObjectURL(blob);
 *     }
 * };
 *
 * // uses as global variable, qbMediaRecorder is built as a UMD module.
 * var recorder = new qbMediaRecorder(opts);
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
 * @param  {String} mimeType - The mimeType to check.
 * @return {Boolean}         - True if the MediaRecorder implementation is capable of recording Blob objects for the specified MIME type.
 *
 * @example
 * if( qbMediaRecorder.isTypeSupported('video/mp4') ) {
 *     el.textContent = 'Will be record in video/mp4';
 * }
 */
qbMediaRecorder.isTypeSupported = function(mimeType) {
    if(!qbMediaRecorder.isAvailable()) {
        throw new Error(ERRORS.unsupport);
    }

    if(!mimeType) {
        throw new Error(ERRORS.requreArgument);
    }

    return window.MediaRecorder.isTypeSupported(mimeType);
}

/**
 * Return all supported mime types and container format.
 * @param  {String} [type=video] Type of media.
 * @return {Array}                   Array of supported mimetypes.Recommended mimetype has 0 index.
 *
 * @example
 * var type = qbMediaRecorder.getSupportedMimeTypes('audio');
 * console.info(`Call will recording in ${type[0]}`);
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
 *
 * @example
 * var options = {
 *     onstart: function onStart() {
 *         var time = 0,
 *             step = 1000;
 *         
 *         setTimeout(function () {
 *             time += step;
 *             console.info(`You are recording ${time} sec.`);
 *         }, step);
 *     }
 * }
 *
 * var rec = new qbRecorder(options);
 * // ...
 * rec.start(stream);
 */
qbMediaRecorder.prototype.start = function(stream) {
    var self = this;

    if(!stream) {
        throw new Error(ERRORS.requreArgument);
    }

    var mediaRecorderState = this.getState();

    if(mediaRecorderState === qbMediaRecorder._STATES[1] || mediaRecorderState === qbMediaRecorder._STATES[2]) {
        this._mediaRecorder.stop();
    }

    if(this._stream) {
        this._stream = null;
    }
    // TODO: need to stream.clone
    self._stream = stream;

    self._mediaRecorder = null;
    self._recordedChunks.length = 0;

    self._setMediaRecorder();
    self._setEvents();
};

qbMediaRecorder.prototype._setMediaRecorder = function () {
    var self = this;
    
    try {
        self._mediaRecorder = new window.MediaRecorder(self._stream, {
            'mimeType': self.mimeType,
            'ignoreMutedMedia': self.ignoreMutedMedia
        });
    } catch(e) {
        console.warn(ERRORS.unsupportMediaRecorderWithOptions, e);

        self._mediaRecorder = new window.MediaRecorder(self._stream);
    }
};

qbMediaRecorder.prototype._setEvents = function() {
    var self = this;

    function fireCallback(name, args) {
        if(Object.keys(self.callbacks).length !== 0 && typeof self.callbacks[name] === 'function') {
            try {
                self.callbacks[name](args);
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
        fireCallback('onpause');
    };

    self._mediaRecorder.onresume = function() {
        fireCallback('onresume');
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
            fireCallback('onerror', error);
        }
    };

    self._mediaRecorder.onstop = function() {
        var blob = new Blob(self._recordedChunks, {
            'type' : self.mimeType
        });

        self.recordedBlobs.push(blob);

        if(!self._keepRecording) {

            if(self.recordedBlobs.length > 1) {
                fireCallback('onstop', blob);
            } else {
                fireCallback('onstop', self.recordedBlobs[0]);
            }
        }

        self._keepRecording = false;
    };

    self._mediaRecorder.start(self.timeslice);

    fireCallback('onstart');
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
 * Change a recorded stream.
 * @param {MediaStream} stream - Stream object representing a flux of audio- or video-related data.
 * @returns {void}
 */
qbMediaRecorder.prototype.change = function(stream) {
    var self = this;

    if(!stream) {
        throw new Error(ERRORS.requreArgument);
    }

    self._keepRecording = true; // don't stop a record
    self.stop();

    self._stream = null;
    self._mediaRecorder = null;

    // TODO stream.clone
    self._stream = stream;

    self._setMediaRecorder();
    self._setEvents();
};

/**
 * Create a file from blob and download as the file. Its method will fire 'stop' if recording in progress.
 * @param {Strint} [fileName=Date.now()] - Name of file.
 * @param {Blob}   [blob] - You can set blob which you get from the method `stop` or don't set anything and we will get recorded chuncks.
 * @returns {void}
 *
 * @example
 * var rec = new qbRecorder();
 * rec.start(stream);
 * // ...
 * rec.download(false); // Set false, name will be generated based on Date.now()
 */
qbMediaRecorder.prototype.download = function(fileName, blob) {
    var self = this;

    var mediaRecorderState = this.getState();

    if(mediaRecorderState === qbMediaRecorder._STATES[1] || mediaRecorderState === qbMediaRecorder._STATES[2]) {
        this._mediaRecorder.stop();
    }

    var url = URL.createObjectURL(blob || self._getBlobRecorded()),
        a = document.createElement('a');

    a.style.display = 'none';
    a.href = url;
    a.download = (fileName || Date.now()) + '.' + self._getExtension();

    document.body.appendChild(a);

    // Start dowloading
    a.click();
    
    // Remove link
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

    return new Blob(chunks, { 'type' : self.mimeType });
};

/**
 * Return a extension of a file. Based on available mimeType.
 * @access private
 * @return {String} For example, 'webm' / 'mp4' / 'ogg'
 */
qbMediaRecorder.prototype._getExtension = function() {
    var self = this;

    var endTypeMedia = self.mimeType.indexOf('/'),
        extension = self.mimeType.substring(endTypeMedia + 1),
        startCodecsInfo = extension.indexOf(';');

    if(startCodecsInfo !== -1) {
        extension = extension.substring(0, startCodecsInfo);
    }

    return extension;
};

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZXJyb3JzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL21pbWVUeXBlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxY0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ3Vuc3VwcG9ydCc6ICdxYk1lZGlhUmVjb3JkZXIgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGVudmlyb25tZW50LicsXHJcbiAgICAndW5zdXBwb3J0TWVkaWFSZWNvcmRlcldpdGhPcHRpb25zJzogJ0dvdCBhIHdhcm5pbmcgd2hlbiBjcmVhdGluZyBhIE1lZGlhUmVjb3JkZXIsIHRyeWluZyB0byBjcmVhdGUgTWVkaWFSZWNvcmRlciB3aXRob3V0IG9wdGlvbnMuJyxcclxuICAgICdyZXF1cmVBcmd1bWVudCc6ICcxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuJyxcclxuICAgICdjYWxsYmFja0Vycm9yJzogJ0ZvdW5kZWQgYW4gZXJyb3IgaW4gY2FsbGJhY2s6JyxcclxuICAgICdhY3Rpb25GYWlsZWQnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBjcmVhdGVkIG9yIGhhcyBhbiBpbnZhbGlkIHN0YXRlLicsXHJcbiAgICAnbm9fcmVjb3JkZWRfY2h1bmtzJzogJ0RvZXMgbm90IGhhdmUgYW55IHJlY29yZGluZyBkYXRhLicsXHJcbiAgICAnc3RyZWFtUmVxdWlyZWQnOiAnTWVkaWFTdHJlYW0gaXMgcmVxdWlyZWQuJyxcclxuICAgICdJbnZhbGlkU3RhdGUnOiAncWJNZWRpYVJlY29yZGVyIGlzIG5vdCBpbiBhIHN0YXRlIGluIHdoaWNoIHRoZSBwcm9wb3NlZCBvcGVyYXRpb24gaXMgYWxsb3dlZCB0byBiZSBleGVjdXRlZC4nLFxyXG4gICAgJ091dE9mTWVtb3J5JzogJ1RoZSBVQSBoYXMgZXhoYXVzZWQgdGhlIGF2YWlsYWJsZSBtZW1vcnkuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdJbGxlZ2FsU3RyZWFtTW9kaWZpY2F0aW9uJzogJ0EgbW9kaWZpY2F0aW9uIHRvIHRoZSBzdHJlYW0gaGFzIG9jY3VycmVkIHRoYXQgbWFrZXMgaXQgaW1wb3NzaWJsZSB0byBjb250aW51ZSByZWNvcmRpbmcuIEFuIGV4YW1wbGUgd291bGQgYmUgdGhlIGFkZGl0aW9uIG9mIGEgVHJhY2sgd2hpbGUgcmVjb3JkaW5nIGlzIG9jY3VycmluZy4gVXNlciBhZ2VudHMgU0hPVUxEIHByb3ZpZGUgYXMgbXVjaCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFzIHBvc3NpYmxlIGluIHRoZSBtZXNzYWdlIGF0dHJpYnV0ZS4nLFxyXG4gICAgJ090aGVyUmVjb3JkaW5nRXJyb3InOiAnVXNlZCBmb3IgYW4gZmF0YWwgZXJyb3Igb3RoZXIgdGhhbiB0aG9zZSBsaXN0ZWQgYWJvdmUuIFVzZXIgYWdlbnRzIFNIT1VMRCBwcm92aWRlIGFzIG11Y2ggYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhcyBwb3NzaWJsZSBpbiB0aGUgbWVzc2FnZSBhdHRyaWJ1dGUuJyxcclxuICAgICdHZW5lcmljRXJyb3InOiAnVGhlIFVBIGNhbm5vdCBwcm92aWRlIHRoZSBjb2RlYyBvciByZWNvcmRpbmcgb3B0aW9uIHRoYXQgaGFzIGJlZW4gcmVxdWVzdGVkJ1xyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBFUlJPUlMgPSByZXF1aXJlKCcuL2Vycm9ycycpO1xyXG5cclxuLyoqXHJcbiAqIEBjb25zdHJ1Y3RvciBxYk1lZGlhUmVjb3JkZXJcclxuICogQHBhcmFtIHtPYmplY3R9ICAgW29wdHNdIC0gT2JqZWN0IG9mIHBhcmFtZXRlcnMuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSAgIG9wdHNbXS5taW1lVHlwZT12aWRlbyAtIFNwZWNpZmllcyB0aGUgbWVkaWEgdHlwZSBhbmQgY29udGFpbmVyIGZvcm1hdCBmb3IgdGhlIHJlY29yZGluZy4gWW91IGNhbiBzZXQgc2ltcGx5OiAndmlkZW8nIG9yICdhdWRpbycgb3IgJ2F1ZGlvL3dlYm0nO1xyXG4gKiBAcGFyYW0ge051bWJlcn0gICBvcHRzW10udGltZXNsaWNlPTEwMDAgLSBUaGUgbWluaW11bSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIG9mIGRhdGEgdG8gcmV0dXJuIGluIGEgc2luZ2xlIEJsb2IsIGZpcmUgJ29uZGF0YWF2YWlibGUnIGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59ICBvcHRzW10uaWdub3JlTXV0ZWRNZWRpYT10cnVlIC0gV2hhdCB0byBkbyB3aXRoIGEgbXV0ZWQgaW5wdXQgTWVkaWFTdHJlYW1UcmFjaywgZS5nLiBpbnNlcnQgYmxhY2sgZnJhbWVzL3plcm8gYXVkaW8gdm9sdW1lIGluIHRoZSByZWNvcmRpbmcgb3IgaWdub3JlIGFsdG9nZXRoZXIuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0YXJ0IC0gQ2FsbGVkIHRvIGhhbmRsZSB0aGUgc3RhcnQgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbnN0b3AgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBzdG9wIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25wYXVzZSAtIENhbGxlZCB0byBoYW5kbGUgdGhlIHBhdXNlIGV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25yZXN1bWUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSByZXN1bWUgZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmVycm9yIC0gQ2FsbGVkIHRvIGhhbmRsZSBhbiBFcnJvckV2ZW50LlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzW10ub25jaGFuZ2UgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBjaGFuZ2UgYSBzdHJlYW0gZXZlbnQuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdHNbXS5vbmRhdGFhdmFpbGFibGUgLSBDYWxsZWQgdG8gaGFuZGxlIHRoZSBkYXRhYXZhaWxhYmxlIGV2ZW50LiBUaGUgQmxvYiBvZiByZWNvcmRlZCBkYXRhIGlzIGNvbnRhaW5lZCBpbiB0aGlzIGV2ZW50LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgb3B0cyA9IHtcclxuICogICAgIG9uc3RhcnQ6IGZ1bmN0aW9uIG9uU3RhcnQoKSB7IC8vIFVzZSBuYW1lZCBmdW5jdGlvbi5cclxuICogICAgICAgICBjb25zb2xlLmxvZygnUmVjb3JkZXIgaXMgc3RhcnRlZCcpO1xyXG4gKiAgICAgfSxcclxuICogICAgIG9uc3RvcDogZnVuY3Rpb24gb25TdG9wKEJsb2IpIHtcclxuICogICAgICAgICB2aWRlb0VsZW1lbnQuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICogICAgIH1cclxuICogfTtcclxuICpcclxuICogLy8gdXNlcyBhcyBnbG9iYWwgdmFyaWFibGUsIHFiTWVkaWFSZWNvcmRlciBpcyBidWlsdCBhcyBhIFVNRCBtb2R1bGUuXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBxYk1lZGlhUmVjb3JkZXIob3B0cyk7XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiBxYk1lZGlhUmVjb3JkZXIob3B0cykge1xyXG4gICAgaWYoIXFiTWVkaWFSZWNvcmRlci5pc0F2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy51bnN1cHBvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcmVmZmVyZWRNaW1lVHlwZSA9IG9wdHMgJiYgb3B0cy5taW1lVHlwZSA/IG9wdHMubWltZVR5cGUgOiBmYWxzZTtcclxuXHJcbiAgICB0aGlzLm1pbWVUeXBlID0gdGhpcy5fZ2V0TWltZVR5cGUocHJlZmZlcmVkTWltZVR5cGUpO1xyXG4gICAgdGhpcy50aW1lc2xpY2UgPSBvcHRzICYmIG9wdHMudGltZXNsaWNlICYmIGlzTmFOKCtvcHRzLnRpbWVzbGljZSkgPyBvcHRzLnRpbWVzbGljZSA6IDEwMDA7XHJcbiAgICB0aGlzLmNhbGxiYWNrcyA9IG9wdHMgPyB0aGlzLl9nZXRDYWxsYmFja3Mob3B0cykgOiB7fTtcclxuICAgIHRoaXMucmVjb3JkZWRCbG9icyA9IFtdO1xyXG4gICAgdGhpcy5pZ25vcmVNdXRlZE1lZGlhID0gb3B0cyAmJiB0eXBlb2Yob3B0cy5pZ25vcmVNdXRlZE1lZGlhKSA9PT0gJ2Jvb2xlYW4nID8gb3B0cy5pZ25vcmVNdXRlZE1lZGlhIDogdHJ1ZTtcclxuICAgIFxyXG4gICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIHRoaXMuX21lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG4gICAgdGhpcy5fcmVjb3JkZWRDaHVua3MgPSBbXTtcclxuICAgIHRoaXMuX2tlZXBSZWNvcmRpbmcgPSBmYWxzZTtcclxufVxyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0TWltZVR5cGUgPSBmdW5jdGlvbiAocHJlZmZlcmVkKSB7XHJcbiAgICB2YXIgbWltZVR5cGUsXHJcbiAgICAgICAgdHlwZSA9ICd2aWRlbyc7XHJcblxyXG4gICAgaWYocHJlZmZlcmVkICYmIHFiTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQocHJlZmZlcmVkKSkge1xyXG4gICAgICAgIG1pbWVUeXBlID0gcHJlZmZlcmVkO1xyXG4gICAgfSBlbHNlIGlmKHByZWZmZXJlZCkge1xyXG4gICAgICAgIHR5cGUgPSBwcmVmZmVyZWQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2F1ZGlvJykgPT09IC0xID8gJ3ZpZGVvJyA6ICdhdWRpbyc7XHJcbiAgICAgICAgbWltZVR5cGUgPSBxYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzKHR5cGUpWzBdO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBtaW1lVHlwZSA9IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXModHlwZSlbMF07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1pbWVUeXBlO1xyXG59XHJcblxyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9nZXRDYWxsYmFja3MgPSBmdW5jdGlvbihvcHRzKSB7XHJcbiAgICB2YXIgY2FsbGJhY2tzID0ge30sXHJcbiAgICAgICAgY2FsbGJhY2tOYW1lcyA9IFsnb25zdGFydCcsICdvbnN0b3AnLCAnb25wYXVzZScsICdvbnJlc3VtZScsICdvbmVycm9yJywgJ29uY2hhbmdlJywgJ29uZGF0YWF2YWlsYWJsZSddO1xyXG5cclxuICAgIGNhbGxiYWNrTmFtZXMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XHJcbiAgICAgICAgaWYgKG5hbWUgaW4gb3B0cykge1xyXG4gICAgICAgICAgICBjYWxsYmFja3NbbmFtZV0gPSBvcHRzW25hbWVdO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBjYWxsYmFja3M7XHJcbn1cclxuXHJcbnFiTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzID0gcmVxdWlyZSgnLi9taW1lVHlwZXMnKTtcclxuXHJcbnFiTWVkaWFSZWNvcmRlci5fU1RBVEVTID0gWydpbmFjdGl2ZScsICdyZWNvcmRpbmcnLCAncGF1c2VkJ107XHJcblxyXG4vKipcclxuICogSXQgY2hlY2tzIGNhcGFiaWxpdHkgb2YgcmVjb3JkaW5nIGluIHRoZSBlbnZpcm9ubWVudC5cclxuICogQ2hlY2tzIE1lZGlhUmVjb3JkZXIsIE1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkIGFuZCBCbG9iLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHFiTWVkaWFSZWNvcmRlciBpcyBhdmFpbGFibGUgYW5kIGNhbiBydW4sIG9yIGZhbHNlIG90aGVyd2lzZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogaWYocWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICogICAgIC8vIC4uLiBzaG93IFVJIGZvciByZWNvcmRpbmdcclxuICogfVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlID0gZnVuY3Rpb24oKXtcclxuICAgIHJldHVybiAhISh3aW5kb3cgJiYgd2luZG93Lk1lZGlhUmVjb3JkZXIgJiYgdHlwZW9mIHdpbmRvdy5NZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCA9PT0gJ2Z1bmN0aW9uJyAmJiB3aW5kb3cuQmxvYik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgQm9vbGVhbiB3aGljaCBpcyB0cnVlIGlmIHRoZSBNSU1FIHR5cGUgc3BlY2lmaWVkIGlzIG9uZSB0aGUgdXNlciBhZ2VudCBjYW4gcmVjb3JkLlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IG1pbWVUeXBlIC0gVGhlIG1pbWVUeXBlIHRvIGNoZWNrLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgIC0gVHJ1ZSBpZiB0aGUgTWVkaWFSZWNvcmRlciBpbXBsZW1lbnRhdGlvbiBpcyBjYXBhYmxlIG9mIHJlY29yZGluZyBCbG9iIG9iamVjdHMgZm9yIHRoZSBzcGVjaWZpZWQgTUlNRSB0eXBlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBpZiggcWJNZWRpYVJlY29yZGVyLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0JykgKSB7XHJcbiAqICAgICBlbC50ZXh0Q29udGVudCA9ICdXaWxsIGJlIHJlY29yZCBpbiB2aWRlby9tcDQnO1xyXG4gKiB9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkID0gZnVuY3Rpb24obWltZVR5cGUpIHtcclxuICAgIGlmKCFxYk1lZGlhUmVjb3JkZXIuaXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMudW5zdXBwb3J0KTtcclxuICAgIH1cclxuXHJcbiAgICBpZighbWltZVR5cGUpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnJlcXVyZUFyZ3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gd2luZG93Lk1lZGlhUmVjb3JkZXIuaXNUeXBlU3VwcG9ydGVkKG1pbWVUeXBlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhbGwgc3VwcG9ydGVkIG1pbWUgdHlwZXMgYW5kIGNvbnRhaW5lciBmb3JtYXQuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gW3R5cGU9dmlkZW9dIFR5cGUgb2YgbWVkaWEuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBzdXBwb3J0ZWQgbWltZXR5cGVzLlJlY29tbWVuZGVkIG1pbWV0eXBlIGhhcyAwIGluZGV4LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgdHlwZSA9IHFiTWVkaWFSZWNvcmRlci5nZXRTdXBwb3J0ZWRNaW1lVHlwZXMoJ2F1ZGlvJyk7XHJcbiAqIGNvbnNvbGUuaW5mbyhgQ2FsbCB3aWxsIHJlY29yZGluZyBpbiAke3R5cGVbMF19YCk7XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIuZ2V0U3VwcG9ydGVkTWltZVR5cGVzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgdmFyIHR5cGVNZWRpYSA9IHR5cGUgfHwgJ3ZpZGVvJztcclxuXHJcbiAgICBpZighcWJNZWRpYVJlY29yZGVyLmlzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoRVJST1JTLnVuc3VwcG9ydCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHFiTWVkaWFSZWNvcmRlci5fbWltZVR5cGVzW3R5cGVNZWRpYV0uZmlsdGVyKGZ1bmN0aW9uKG1pbWVUeXBlKSB7XHJcbiAgICAgICAgcmV0dXJuIHFiTWVkaWFSZWNvcmRlci5pc1R5cGVTdXBwb3J0ZWQobWltZVR5cGUpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gdGhlIGN1cnJlbnQgW3N0YXRlIG9mIHFiTWVkaWFSZWNvcmRlciBpbnN0YW5jZV0oaHR0cHM6Ly93M2MuZ2l0aHViLmlvL21lZGlhY2FwdHVyZS1yZWNvcmQvTWVkaWFSZWNvcmRlci5odG1sI2lkbC1kZWYtcmVjb3JkaW5nc3RhdGUpLlxyXG4gKiBQb3NzaWJseSBzdGF0ZXM6ICoqaW5hY3RpdmUqKiwgKipyZWNvcmRpbmcqKiwgKipwYXVzZWQqKi5cclxuICogQHJldHVybiB7U3RyaW5nfSBOYW1lIG9mIGEgc3RhdGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWNvcmRlciA9IG5ldyBxYk1lZGlhUmVjb3JkZXIoKTtcclxuICogLy8gLi4uc29tZSBjb2RlXHJcbiAqXHJcbiAqIGlmKHJlY29yZGVyLmdldFN0YXRlKCkgPT0gJ3JlY29yZGluZycpIHtcclxuICogICAgIGNvbnNvbGUuaW5mbygnWW91IGFyZSBzdGlsbCByZWNvcmRpbmcuJyk7XHJcbiAqIH1cclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLl9tZWRpYVJlY29yZGVyID8gdGhpcy5fbWVkaWFSZWNvcmRlci5zdGF0ZSA6IHFiTWVkaWFSZWNvcmRlci5fU1RBVEVTWzBdO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFN0YXJ0IHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogRmlyZSB0aGUgbWV0aG9kIGBzdG9wYCBpZiBhbiBpbnN0YW5jZSBpbnByb2dyZXNzIChoYXMgYSBzdGF0ZSByZWNvcmRpbmcgb3IgcGF1c2VkKS5cclxuICogRmlyZSBvbnN0YXJ0IGNhbGxiYWNrLlxyXG4gKiBAcGFyYW0ge01lZGlhU3RyZWFtfSBzdHJlYW0gLSBTdHJlYW0gb2JqZWN0IHJlcHJlc2VudGluZyBhIGZsdXggb2YgYXVkaW8tIG9yIHZpZGVvLXJlbGF0ZWQgZGF0YS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBvcHRpb25zID0ge1xyXG4gKiAgICAgb25zdGFydDogZnVuY3Rpb24gb25TdGFydCgpIHtcclxuICogICAgICAgICB2YXIgdGltZSA9IDAsXHJcbiAqICAgICAgICAgICAgIHN0ZXAgPSAxMDAwO1xyXG4gKiAgICAgICAgIFxyXG4gKiAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gKiAgICAgICAgICAgICB0aW1lICs9IHN0ZXA7XHJcbiAqICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgWW91IGFyZSByZWNvcmRpbmcgJHt0aW1lfSBzZWMuYCk7XHJcbiAqICAgICAgICAgfSwgc3RlcCk7XHJcbiAqICAgICB9XHJcbiAqIH1cclxuICpcclxuICogdmFyIHJlYyA9IG5ldyBxYlJlY29yZGVyKG9wdGlvbnMpO1xyXG4gKiAvLyAuLi5cclxuICogcmVjLnN0YXJ0KHN0cmVhbSk7XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oc3RyZWFtKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXN0cmVhbSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihFUlJPUlMucmVxdXJlQXJndW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBtZWRpYVJlY29yZGVyU3RhdGUgPSB0aGlzLmdldFN0YXRlKCk7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlclN0YXRlID09PSBxYk1lZGlhUmVjb3JkZXIuX1NUQVRFU1sxXSB8fCBtZWRpYVJlY29yZGVyU3RhdGUgPT09IHFiTWVkaWFSZWNvcmRlci5fU1RBVEVTWzJdKSB7XHJcbiAgICAgICAgdGhpcy5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy5fc3RyZWFtKSB7XHJcbiAgICAgICAgdGhpcy5fc3RyZWFtID0gbnVsbDtcclxuICAgIH1cclxuICAgIC8vIFRPRE86IG5lZWQgdG8gc3RyZWFtLmNsb25lXHJcbiAgICBzZWxmLl9zdHJlYW0gPSBzdHJlYW07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlciA9IG51bGw7XHJcbiAgICBzZWxmLl9yZWNvcmRlZENodW5rcy5sZW5ndGggPSAwO1xyXG5cclxuICAgIHNlbGYuX3NldE1lZGlhUmVjb3JkZXIoKTtcclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fc2V0TWVkaWFSZWNvcmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSwge1xyXG4gICAgICAgICAgICAnbWltZVR5cGUnOiBzZWxmLm1pbWVUeXBlLFxyXG4gICAgICAgICAgICAnaWdub3JlTXV0ZWRNZWRpYSc6IHNlbGYuaWdub3JlTXV0ZWRNZWRpYVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy51bnN1cHBvcnRNZWRpYVJlY29yZGVyV2l0aE9wdGlvbnMsIGUpO1xyXG5cclxuICAgICAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbmV3IHdpbmRvdy5NZWRpYVJlY29yZGVyKHNlbGYuX3N0cmVhbSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLl9zZXRFdmVudHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBmaXJlQ2FsbGJhY2sobmFtZSwgYXJncykge1xyXG4gICAgICAgIGlmKE9iamVjdC5rZXlzKHNlbGYuY2FsbGJhY2tzKS5sZW5ndGggIT09IDAgJiYgdHlwZW9mIHNlbGYuY2FsbGJhY2tzW25hbWVdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBzZWxmLmNhbGxiYWNrc1tuYW1lXShhcmdzKTtcclxuICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGb3VuZGVkIGFuIGVycm9yIGluIGNhbGxiYWNrOicgKyBuYW1lLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZihlLmRhdGEgJiYgZS5kYXRhLnNpemUgPiAwKSB7XHJcbiAgICAgICAgICAgIHNlbGYuX3JlY29yZGVkQ2h1bmtzLnB1c2goZS5kYXRhKTtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmRhdGFhdmFpbGFibGUnLCBlKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNlbGYuX21lZGlhUmVjb3JkZXIub25wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZpcmVDYWxsYmFjaygnb25wYXVzZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9ucmVzdW1lID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnJlc3VtZScpO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xyXG4gICAgICAgIHN3aXRjaChlcnJvci5uYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ0ludmFsaWRTdGF0ZSc6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ091dE9mTWVtb3J5JzpcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoRVJST1JTW2Vycm9yLm5hbWVdKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnSWxsZWdhbFN0cmVhbU1vZGlmaWNhdGlvbic6XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKEVSUk9SU1tlcnJvci5uYW1lXSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ090aGVyUmVjb3JkaW5nRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdHZW5lcmljRXJyb3InOlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihFUlJPUlNbZXJyb3IubmFtZV0pO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTWVkaWFSZWNvcmRlciBFcnJvcicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlci5zdGF0ZSAhPT0gJ2luYWN0aXZlJyAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlICE9PSAnc3RvcHBlZCcpIHtcclxuICAgICAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihzZWxmLl91c2VyQ2FsbGJhY2tzICYmIHR5cGVvZiBzZWxmLl91c2VyQ2FsbGJhY2tzLm9uRXJyb3JSZWNvcmRpbmcgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbmVycm9yJywgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2VsZi5fbWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iKHNlbGYuX3JlY29yZGVkQ2h1bmtzLCB7XHJcbiAgICAgICAgICAgICd0eXBlJyA6IHNlbGYubWltZVR5cGVcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgc2VsZi5yZWNvcmRlZEJsb2JzLnB1c2goYmxvYik7XHJcblxyXG4gICAgICAgIGlmKCFzZWxmLl9rZWVwUmVjb3JkaW5nKSB7XHJcblxyXG4gICAgICAgICAgICBpZihzZWxmLnJlY29yZGVkQmxvYnMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgZmlyZUNhbGxiYWNrKCdvbnN0b3AnLCBibG9iKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGZpcmVDYWxsYmFjaygnb25zdG9wJywgc2VsZi5yZWNvcmRlZEJsb2JzWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXJ0KHNlbGYudGltZXNsaWNlKTtcclxuXHJcbiAgICBmaXJlQ2FsbGJhY2soJ29uc3RhcnQnKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdG9wIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybiB7QmxvYn0gQmxvYiBvZiByZWNvcmRlZCBjaHVuY2tzLlxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlciA9IHRoaXMuX21lZGlhUmVjb3JkZXIsXHJcbiAgICAgICAgbWVkaWFSZWNvcmRlclN0YXRlID0gbWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyLnN0YXRlID8gbWVkaWFSZWNvcmRlci5zdGF0ZSA6ICdpbmFjdGl2ZSc7XHJcblxyXG4gICAgaWYobWVkaWFSZWNvcmRlciAmJiBtZWRpYVJlY29yZGVyU3RhdGUgPT09ICdyZWNvcmRpbmcnKXtcclxuICAgICAgICBtZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFBhdXNlIHRvIHJlY29yZGluZyBhIHN0cmVhbS5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYoc2VsZi5fbWVkaWFSZWNvcmRlciAmJiBzZWxmLl9tZWRpYVJlY29yZGVyLnN0YXRlID09PSAncmVjb3JkaW5nJykge1xyXG4gICAgICAgIHNlbGYuX21lZGlhUmVjb3JkZXIucGF1c2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlc3VtZSB0byByZWNvcmRpbmcgYSBzdHJlYW0uXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZihzZWxmLl9tZWRpYVJlY29yZGVyICYmIHNlbGYuX21lZGlhUmVjb3JkZXIuc3RhdGUgPT09ICdwYXVzZWQnKSB7XHJcbiAgICAgICAgc2VsZi5fbWVkaWFSZWNvcmRlci5yZXN1bWUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5hY3Rpb25GYWlsZWQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBhIHJlY29yZGVkIHN0cmVhbS5cclxuICogQHBhcmFtIHtNZWRpYVN0cmVhbX0gc3RyZWFtIC0gU3RyZWFtIG9iamVjdCByZXByZXNlbnRpbmcgYSBmbHV4IG9mIGF1ZGlvLSBvciB2aWRlby1yZWxhdGVkIGRhdGEuXHJcbiAqIEByZXR1cm5zIHt2b2lkfVxyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5jaGFuZ2UgPSBmdW5jdGlvbihzdHJlYW0pIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBpZighc3RyZWFtKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKEVSUk9SUy5yZXF1cmVBcmd1bWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2VsZi5fa2VlcFJlY29yZGluZyA9IHRydWU7IC8vIGRvbid0IHN0b3AgYSByZWNvcmRcclxuICAgIHNlbGYuc3RvcCgpO1xyXG5cclxuICAgIHNlbGYuX3N0cmVhbSA9IG51bGw7XHJcbiAgICBzZWxmLl9tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuXHJcbiAgICAvLyBUT0RPIHN0cmVhbS5jbG9uZVxyXG4gICAgc2VsZi5fc3RyZWFtID0gc3RyZWFtO1xyXG5cclxuICAgIHNlbGYuX3NldE1lZGlhUmVjb3JkZXIoKTtcclxuICAgIHNlbGYuX3NldEV2ZW50cygpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIGZpbGUgZnJvbSBibG9iIGFuZCBkb3dubG9hZCBhcyB0aGUgZmlsZS4gSXRzIG1ldGhvZCB3aWxsIGZpcmUgJ3N0b3AnIGlmIHJlY29yZGluZyBpbiBwcm9ncmVzcy5cclxuICogQHBhcmFtIHtTdHJpbnR9IFtmaWxlTmFtZT1EYXRlLm5vdygpXSAtIE5hbWUgb2YgZmlsZS5cclxuICogQHBhcmFtIHtCbG9ifSAgIFtibG9iXSAtIFlvdSBjYW4gc2V0IGJsb2Igd2hpY2ggeW91IGdldCBmcm9tIHRoZSBtZXRob2QgYHN0b3BgIG9yIGRvbid0IHNldCBhbnl0aGluZyBhbmQgd2Ugd2lsbCBnZXQgcmVjb3JkZWQgY2h1bmNrcy5cclxuICogQHJldHVybnMge3ZvaWR9XHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciByZWMgPSBuZXcgcWJSZWNvcmRlcigpO1xyXG4gKiByZWMuc3RhcnQoc3RyZWFtKTtcclxuICogLy8gLi4uXHJcbiAqIHJlYy5kb3dubG9hZChmYWxzZSk7IC8vIFNldCBmYWxzZSwgbmFtZSB3aWxsIGJlIGdlbmVyYXRlZCBiYXNlZCBvbiBEYXRlLm5vdygpXHJcbiAqL1xyXG5xYk1lZGlhUmVjb3JkZXIucHJvdG90eXBlLmRvd25sb2FkID0gZnVuY3Rpb24oZmlsZU5hbWUsIGJsb2IpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICB2YXIgbWVkaWFSZWNvcmRlclN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xyXG5cclxuICAgIGlmKG1lZGlhUmVjb3JkZXJTdGF0ZSA9PT0gcWJNZWRpYVJlY29yZGVyLl9TVEFURVNbMV0gfHwgbWVkaWFSZWNvcmRlclN0YXRlID09PSBxYk1lZGlhUmVjb3JkZXIuX1NUQVRFU1syXSkge1xyXG4gICAgICAgIHRoaXMuX21lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IgfHwgc2VsZi5fZ2V0QmxvYlJlY29yZGVkKCkpLFxyXG4gICAgICAgIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcblxyXG4gICAgYS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgYS5ocmVmID0gdXJsO1xyXG4gICAgYS5kb3dubG9hZCA9IChmaWxlTmFtZSB8fCBEYXRlLm5vdygpKSArICcuJyArIHNlbGYuX2dldEV4dGVuc2lvbigpO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcblxyXG4gICAgLy8gU3RhcnQgZG93bG9hZGluZ1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgXHJcbiAgICAvLyBSZW1vdmUgbGlua1xyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICB9LCAxMDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIEJsb2IgZnJvbSByZWNvcmRlZCBjaHVua3MuXHJcbiAqIEBhY2Nlc3MgcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIC0gUmVjb3JkZWQgZGF0YS5cclxuICogQHJldHVybiB7T2JqZWN0fSAtIEJsb2Igb2YgcmVjb3JkZWQgbWVkaWEgb3Igd2hhdCB5b3Ugc2V0IGluIGRhdGFcclxuICovXHJcbnFiTWVkaWFSZWNvcmRlci5wcm90b3R5cGUuX2dldEJsb2JSZWNvcmRlZCA9IGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgICBjaHVua3MgPSBkYXRhIHx8IHNlbGYuX3JlY29yZGVkQ2h1bmtzO1xyXG5cclxuICAgIGlmKCFjaHVua3MubGVuZ3RoKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKEVSUk9SUy5ub19yZWNvcmRlZF9jaHVua3MpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IEJsb2IoY2h1bmtzLCB7ICd0eXBlJyA6IHNlbGYubWltZVR5cGUgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJuIGEgZXh0ZW5zaW9uIG9mIGEgZmlsZS4gQmFzZWQgb24gYXZhaWxhYmxlIG1pbWVUeXBlLlxyXG4gKiBAYWNjZXNzIHByaXZhdGVcclxuICogQHJldHVybiB7U3RyaW5nfSBGb3IgZXhhbXBsZSwgJ3dlYm0nIC8gJ21wNCcgLyAnb2dnJ1xyXG4gKi9cclxucWJNZWRpYVJlY29yZGVyLnByb3RvdHlwZS5fZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGVuZFR5cGVNZWRpYSA9IHNlbGYubWltZVR5cGUuaW5kZXhPZignLycpLFxyXG4gICAgICAgIGV4dGVuc2lvbiA9IHNlbGYubWltZVR5cGUuc3Vic3RyaW5nKGVuZFR5cGVNZWRpYSArIDEpLFxyXG4gICAgICAgIHN0YXJ0Q29kZWNzSW5mbyA9IGV4dGVuc2lvbi5pbmRleE9mKCc7Jyk7XHJcblxyXG4gICAgaWYoc3RhcnRDb2RlY3NJbmZvICE9PSAtMSkge1xyXG4gICAgICAgIGV4dGVuc2lvbiA9IGV4dGVuc2lvbi5zdWJzdHJpbmcoMCwgc3RhcnRDb2RlY3NJbmZvKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxYk1lZGlhUmVjb3JkZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgJ2F1ZGlvJzogW1xyXG4gICAgICAgICdhdWRpby93ZWJtO2NvZGVjcz1vcHVzJyxcclxuICAgICAgICAnYXVkaW8vd2VibScsXHJcbiAgICAgICAgJ2F1ZGlvL29nZydcclxuICAgIF0sXHJcbiAgICAndmlkZW8nOiBbXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm07Y29kZWNzPWgyNjQnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDknLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz12cDgnLFxyXG4gICAgICAgICd2aWRlby93ZWJtO2NvZGVjcz1kYWFsYScsXHJcbiAgICAgICAgJ3ZpZGVvL3dlYm0nLFxyXG4gICAgICAgICd2aWRlby9tcDQnLFxyXG4gICAgICAgICd2aWRlby9tcGVnJ1xyXG4gICAgXVxyXG59OyJdfQ==
