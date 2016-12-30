# qbMediaRecorderJS
The qbMediaRecorder.js is a JavaScript library providing stream object (representing a flux of audio- or video-related data) recording and extending the [MediaStream Recording API](https://w3c.github.io/mediacapture-record/MediaRecorder.html).

Extendings methods:
 - [isAvailable](https://quickblox.github.io/javascript-media-recorder/docs/qbMediaRecorder.html#.isAvailable);
 - [getSupportedMimeTypes](https://quickblox.github.io/javascript-media-recorder/docs/qbMediaRecorder.html#.getSupportedMimeTypes);
 - [change](https://quickblox.github.io/javascript-media-recorder/docs/qbMediaRecorder.html#change);
 - [download](https://quickblox.github.io/javascript-media-recorder/docs/qbMediaRecorder.html#download).

See [docs](https://quickblox.github.io/javascript-media-recorder/docs/) - all public API.
Check our [sample](https://quickblox.github.io/javascript-media-recorder/sample/), use a few source (video / audio).

### Support
The qbMediaRecorder supports Firefox 49, Chrome 49 / Chrome for Android 53, Opera 41.

### Usage
The qbMediaRecorder is built as a UMD module and can be loaded via CDN, NPM, or from source.

#### Install 
You can use CDN (by [UNPKG](https://unpkg.com)) to deliver the qbMediaRecorder.
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
#### Contribution
[ESLint](https://github.com/eslint/eslint) uses in project as lint, so install it before start developing.
```bash
npm install -g eslint
```

### Related posts
 * [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

