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