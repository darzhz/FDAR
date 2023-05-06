const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require('socket.io')(server);
const tf = require('@tensorflow/tfjs-node');
const ffmpeg = require('fluent-ffmpeg');
// const Stream = require('node-rtsp-stream');
app.use(express.static('./'));
// stream = new Stream({
//   name: 'cctv',
//   streamUrl: 'rtsp://192.168.143.116:8080/h264_ulaw.sdp',
//   wsPort: 9999,
//   ffmpegOptions: { // options ffmpeg flags
//     '-stats': '', // an option with no neccessary value uses a blank string
//     '-r': 30 // options with required values specify the value after the key
//   }
// })
const streamOptions = {
  name: 'test-stream',
  url: 'rtsp://192.168.143.116:8080/h264_ulaw.sdp',
  port: 554
};
const ffmpegCommand = ffmpeg(streamOptions.url)
  .inputOptions(['-rtsp_transport', 'tcp'])
  .on('start', () => {
    console.log('FFMPEG started');
  })
  .on('error', (err) => {
    console.error('FFMPEG error:', err);
  })
  .outputOptions([
    '-f', 'image2pipe',
    '-pix_fmt', 'rgb24',
    '-vcodec', 'rawvideo',
    '-']);
ffmpegCommand.pipe();

const poseEstimation = async (frame) => {
  //const tensor = tf.browser.fromPixels(frame);
  // Perform pose estimation with TensorFlow.js
  // ...
  let poseResults = "hello";
  return poseResults;
};
io.on('connection', (socket) => {
  console.log('a user connected');

  const streamUrl = `http://localhost/`;

  socket.emit('stream', streamUrl);

  ffmpegCommand.on('data', (data) => {
    const frame = Buffer.from(data);
    poseEstimation(frame)
      .then((poseResults) => {
        socket.emit('pose', poseResults);
      })
      .catch((error) => {
        console.error('Pose estimation failed:', error);
      });
  });
});


server.listen(80, () => {
  console.log(`realnotes listening on 80`);
});
/**
 * 
 * ffmpeg solution
 * 
 * const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const tf = require('@tensorflow/tfjs-node');
const ffmpeg = require('fluent-ffmpeg');

const streamOptions = {
  name: 'test-stream',
  url: 'rtsp://example.com:554/stream',
  port: 8081
};

const ffmpegCommand = ffmpeg(streamOptions.url)
  .inputOptions(['-rtsp_transport', 'tcp'])
  .on('start', () => {
    console.log('FFMPEG started');
  })
  .on('error', (err) => {
    console.error('FFMPEG error:', err);
  })
  .outputOptions([
    '-f', 'image2pipe',
    '-pix_fmt', 'rgb24',
    '-vcodec', 'rawvideo',
    '-']);
  
ffmpegCommand.pipe();

const poseEstimation = async (frame) => {
  const tensor = tf.browser.fromPixels(frame);
  // Perform pose estimation with TensorFlow.js
  // ...
  return poseResults;
};

io.on('connection', (socket) => {
  console.log('a user connected');

  const streamUrl = `http://localhost/`;

  socket.emit('stream', streamUrl);

  ffmpegCommand.on('data', (data) => {
    const frame = Buffer.from(data);
    poseEstimation(frame)
      .then((poseResults) => {
        socket.emit('pose', poseResults);
      })
      .catch((error) => {
        console.error('Pose estimation failed:', error);
      });
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});

 * 
 * 
 * 
 * /



/**

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cv = require('opencv4nodejs');
const tf = require('@tensorflow/tfjs-node');

const rtspStream = require('node-rtsp-stream');

const streamOptions = {
  name: 'test-stream',
  url: 'rtsp://example.com:554/stream',
  port: 8081
};

rtspStream.start(streamOptions);

const poseEstimation = async (frame) => {
  const tensor = tf.browser.fromPixels(frame.toBuffer());
  // Perform pose estimation with TensorFlow.js
  // ...
  return poseResults;
};

io.on('connection', (socket) => {
  console.log('a user connected');

  const streamUrl = `http://localhost:${streamOptions.port}/${streamOptions.name}`;

  socket.emit('stream', streamUrl);

  rtspStream.on('data', (data) => {
    const frame = cv.imdecode(data);
    poseEstimation(frame)
      .then((poseResults) => {
        socket.emit('pose', poseResults);
      })
      .catch((error) => {
        console.error('Pose estimation failed:', error);
      });
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});


**/