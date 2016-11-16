/* JSHint inline rules */
/* jshint node: true, browser: true */
/* globals qbMediaRecorder */

'use strict';
var mediaEl = document.querySelector('.j-video_local');

function getTypeMedia() {
    var radioButtons = document.getElementsByName('type');
    for (var i = 0; i < radioButtons.length; i++) {
        if (radioButtons[i].checked) return radioButtons[i].value;
    }
    return '';
}

function handleGetStreamError(error) {
    console.error(error.name + ': ' + error.message, error);
}

function handleGetStreamSuccess(stream) {
    /* stop previously stream */
    mediaEl.pause();
    mediaEl.src="";
    
    mediaEl.src = URL.createObjectURL(stream);
    mediaEl.play();
}

function getMediaStreamLocal() {
    var constraints = {
        audio: true,
        video: getTypeMedia() === '1' ? false : true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(handleGetStreamSuccess)
        .catch(handleGetStreamError);
}

getMediaStreamLocal();

/** set events listeners */
var radioButtons = document.getElementsByName('type');

for (var i = 0; i < radioButtons.length; i++) {
    radioButtons[i].addEventListener('change', getMediaStreamLocal, false);
}





// var recorder = null,
//     recorderOpts = {
//         mimeType: 'audio',
//         callbacks: {
//             onStart: function onStart() {
//                 console.info('onStart callback');
//             },
//             onStop: function onStop(blob) {
//                 console.info('onStop callback');
                
//                 var videoEl = document.querySelector('.j-videoRecorded');
//                 var btnDownloadEl = document.querySelector('.j-download');
                
//                 videoEl.src = URL.createObjectURL(blob);
//                 videoEl.volume = 0.5;

//                 btnDownloadEl.disabled = false;
//             },
//             onPause: function onStart() {
//                 console.info('onPause callback');
//             },
//             onResume: function onStart() {
//                 console.info('onResume callback');
//             },
//         }
//     };





// * Start sample - choose what type of media you wnat to record. 
// document.querySelector('.j-startSample').addEventListener('click', function() {
//     
// });

    
//        //      ,
//        //      ;

//        //  

//        //  // navigator.mediaDevices.enumerateDevices()
//        //  // .then(function(devices) {
//        //  //     devices.forEach(function(device) {
//        //  //         console.info(device.kind + ": " + device.label + " id = " + device.deviceId);
//        //  //     });
//        //  // });

        

//        //  /** Event listeners */
//        //  document.querySelector('.j-start').addEventListener('click', function() {
//        //      recorder.start();
//        //  });

//        //  document.querySelector('.j-stop').addEventListener('click', function() {
//        //      recorder.stop();
//        //  });

//        //  document.querySelector('.j-pause').addEventListener('click', function() {
//        //      recorder.pause();
//        //  });

//        //  document.querySelector('.j-resume').addEventListener('click', function() {
//        //      recorder.resume();
//        //  });

//        //  document.querySelector('.j-download').addEventListener('click', function() {
//        //      recorder.download();
//        //  });