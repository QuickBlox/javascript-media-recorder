# Media Recorder JS
Beta version now.
Media Recorder JS is a JavaScript library providing cross-browser audio/video recordings.
A wrapper for using the [MediaStream Recording API](https://w3c.github.io/mediacapture-record/MediaRecorder.html).

See [docs](https://quickblox.github.io/javascript-media-recorder/docs/) or a [sample](https://quickblox.github.io/javascript-media-recorder/sample/).

### Support
Media Recorder JS supports Firefox 49, Chrome 49 / Chrome for Android 53, Opera 41.

### Usage
qbMediaRecorder is built as a UMD module that can be loaded via CDN, NPM, or from source.

[ESLint](https://github.com/eslint/eslint) uses in project as lint, so install it before start developing.
```bash
npm install -g eslint
```

#### Install 
You can use CDN (by [UNPKG](https://unpkg.com)) to deliver qbMediaRecorder.
```html
<script src='https://unpkg.com/media-recorder-js/mediaRecorder.js'></script>
```
Or use NPM
```javascript
npm install media-recorder-js --save
```
Also you can download sources from [Github](https://github.com/QuickBlox/javascript-media-recorder), run project by the following commands. 
You will need to have [Gulp](http://gulpjs.com/).

```bash
npm i
npm run build
```

#### Example
```javascript
var opts = {
    mimeType: 'video',       // set mime type of record media or only type of media: 'video'/'audio'. By default if 'video'
    ignoreMutedMedia: false, // What to do with a muted input MediaStreamTrack,
                             // e.g. insert black frames/zero audio volume in the recording or ignore altogether.
                             // By default is `true`.
    timeSlice: 1000,         // optionally be passed a timeslice argument with a value in milliseconds.
                             // the media will be captured in separate chunks of that duration,
                             // rather than the default behavior of recording the media in a single large chunk.
    callbacks: {             // Note! Use named function for better debug.
        onStart: function startRecord() {
            //...
        },
        onError: function errorRecord(error) {
            //...
        },
        onPause: function pauseRecord() {
            //...
        },
        onStop: function stopRecord(blob) {
            //...
        },
        onResume: function resimeRecord() {
            //...
        },
        ondataavailable : function onDataAvaible(e) {
            console.info(e.data) // sliced data (Blob)
        }
    }
}

var rec = new qbMediaRecorder(stream, opts);

rec.start()
// ...
rec.stop();
```

### Related posts
 * [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

