var gulp = require('gulp');
var browserify  = require('browserify');
var source = require('vinyl-source-stream');

var connect = require('gulp-connect');

gulp.task('build', function() {
    return browserify('./src/index.js', {
            'debug': true,
            'standalone': 'qbMediaRecorder'
        })
        .bundle()
        .pipe(source('mediaRecorder.js'))
        .pipe(gulp.dest('./'));
});

gulp.task('connect', function() {
    connect.server({
        port: 8001,
        https: true
      });
});

gulp.task('default', ['build']);

gulp.task('develop', ['connect', 'watch']);

gulp.task('watch', ['build'], function() {
    gulp.watch('src/*.js', ['build']);
});