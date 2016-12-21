# Media Recorder JS
The qbMediaRecorder is a JavaScript library providing cross-browser audio/video recordings and extending the [MediaStream Recording API](https://w3c.github.io/mediacapture-record/MediaRecorder.html).

See [docs](https://quickblox.github.io/javascript-media-recorder/docs/) or a [sample](https://quickblox.github.io/javascript-media-recorder/sample/).

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
#### Example
```javascript
var rec = new qbMediaRecorder(opts); // At first, new a instance of qbMediaRecorder and set all properties.

rec.start()
// ...
rec.stop();
```

#### Contribution
[ESLint](https://github.com/eslint/eslint) uses in project as lint, so install it before start developing.
```bash
npm install -g eslint
```

### Related posts
 * [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

