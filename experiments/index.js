// const express = require('express');
// const app = express();
// const http = require('http').createServer(app);
// const io = require('socket.io')(http);
// const cv = require('opencv4nodejs');
// const tf = require('@tensorflow/tfjs-node');

// const rtspStream = require('node-rtsp-stream');

// const streamOptions = {
//   name: 'test-stream',
//   url: 'rtsp://example.com:554/stream',
//   port: 8081
// };

// rtspStream.start(streamOptions);

// const poseEstimation = async (frame) => {
//   const tensor = tf.browser.fromPixels(frame.toBuffer());
//   // Perform pose estimation with TensorFlow.js
//   // ...
//   return poseResults;
// };

// io.on('connection', (socket) => {
//   console.log('a user connected');

//   const streamUrl = `http://localhost:${streamOptions.port}/${streamOptions.name}`;

//   socket.emit('stream', streamUrl);

//   rtspStream.on('data', (data) => {
//     const frame = cv.imdecode(data);
//     poseEstimation(frame)
//       .then((poseResults) => {
//         socket.emit('pose', poseResults);
//       })
//       .catch((error) => {
//         console.error('Pose estimation failed:', error);
//       });
//   });
// });

// http.listen(3000, () => {
//   console.log('listening on *:3000');
// });
//**********************************rough code ************************************************