![Logo of QBMediaRecorderJS](https://raw.githubusercontent.com/QuickBlox/javascript-media-recorder/master/logo.png)

# QBMediaRecorderJS

> The QBMediaRecorder.js is a JavaScript library providing stream object (representing a flux of audio- or video-related data) recording and extending the [MediaStream Recording API](https://w3c.github.io/mediacapture-record/MediaRecorder.html).

[![npm](https://img.shields.io/npm/v/media-recorder-js.svg)](https://www.npmjs.com/package/media-recorder-js)
[![npm](https://img.shields.io/github/stars/QuickBlox/javascript-media-recorder.svg)](https://www.npmjs.com/package/media-recorder-js)

QBMediaRecorder.js support all native mimetypes and 'audio/wav' and 'audio/mp3'.
For support **wav** and **mp3** add [qbAudioRecorderWorker.js](https://github.com/QuickBlox/javascript-media-recorder/blob/master/qbAudioRecorderWorker.js) to your project and set custom mimeType and workerPath in QBMediaRecorder's options:
```javascript
var opts = {
    // use named function
    onstart: function onStart() {
        console.log('Recorder is started');
    },
    onstop: function onStop(Blob) {
        videoElement.src = URL.createObjectURL(blob);
    },
    // 'audio/wav' or 'audio/mp3'
    mimeType: 'audio/mp3',
    // set relative path (from folder node_modules for example)
    workerPath: '../node_modules/javascript-media-recorder/qbAudioRecorderWorker.js'
};

// uses as global variable, QBMediaRecorder is built as a UMD module.
var recorder = new QBMediaRecorder(opts);
``` 

Extendings methods of MediaRecorder:
 - [isAvailable](https://quickblox.github.io/javascript-media-recorder/docs/QBMediaRecorder.html#.isAvailable);
 - [getSupportedMimeTypes](https://quickblox.github.io/javascript-media-recorder/docs/QBMediaRecorder.html#.getSupportedMimeTypes);
 - [change](https://quickblox.github.io/javascript-media-recorder/docs/QBMediaRecorder.html#change);
 - [download](https://quickblox.github.io/javascript-media-recorder/docs/QBMediaRecorder.html#download).

See [docs](https://quickblox.github.io/javascript-media-recorder/docs/) - all public API.
Check our [sample](https://quickblox.github.io/javascript-media-recorder/sample/), use a few source (video / audio).

### Support
The QBMediaRecorder supports **Firefox 29**, **Chrome 49** / **Chrome 62 for Android**, **Opera 36** and **Safari 6.1** (only **wav** and **mp3**)

### Usage
The QBMediaRecorder is built as a UMD module and can be loaded via CDN, NPM, or from source.

#### Install 
You can use CDN (by [UNPKG](https://unpkg.com)) to deliver the QBMediaRecorder.
```html
<script src='https://unpkg.com/media-recorder-js/mediaRecorder.js'></script>
```
Or use NPM
```bash
npm install media-recorder-js --save
```
Also you can download sources from [Github](https://github.com/QuickBlox/javascript-media-recorder), run project by the following commands. 
You will need to have [Gulp](http://gulpjs.com/).

```bash
npm i
npm run build
```
#### Contribution
[ESLint](https://github.com/eslint/eslint) uses in project as lint, so install it before start developing.
```bash
npm install -g eslint
```

### Related posts
 * [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

