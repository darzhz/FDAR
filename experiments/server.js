const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require('socket.io')(server);
const tf = require('@tensorflow/tfjs');
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
  url: 'rtsp://192.168.1.5:8080/h264_ulaw.sdp',
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
    '-vcodec', 'rawvideo']);
ffmpegCommand.pipe();

const poseEstimation = async (frame) => {
  // Perform pose estimation with TensorFlow.js
  // ...
  let poseResults = "hello";
  console.log(poseResults);
  return poseResults;
};
io.on('connection', (socket) => {
  console.log('a user connected');

  const streamUrl = `http://localhost:8080/`;

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


server.listen(8080, () => {
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
 *    Alt solution
 * 
 * const { spawn } = require('child_process');
const tf = require('@tensorflow/tfjs');

const poseEstimation = async (rtspUrl) => {
  // Load the Movenet Thunder model
  const modelUrl = 'https://tfhub.dev/google/movenet/singlepose/thunder/4';
  const model = await tf.loadGraphModel(modelUrl);

  // Spawn an FFMPEG process to read the RTSP stream
  const ffmpeg = spawn('ffmpeg', [
    '-i', rtspUrl,
    '-f', 'image2pipe',
    '-pix_fmt', 'rgb24',
    '-vcodec', 'rawvideo',
    '-'
  ]);

  // Listen for data events from the FFMPEG process
  let frameCount = 0;
  ffmpeg.stdout.on('data', async (data) => {
    // Convert the data buffer to a Uint8Array
    const frame = new Uint8Array(data);

    // Prepare the input tensor
    const imageTensor = tf.tensor3d(frame, [480, 640, 3], 'int32');
    const inputTensor = imageTensor.expandDims();

    // Run the model inference
    const outputTensor = model.execute(inputTensor);
    const predictions = await outputTensor.array();

    // Convert the output to a more readable format
    const poseResults = predictions.map((pose) => ({
      score: pose[0],
      keypoints: pose.slice(1).map((keypoint) => ({
        name: keypoint[0],
        position: [keypoint[1], keypoint[2]],
        score: keypoint[3]
      }))
    }));

    // Log the pose estimation results
    console.log(`Frame ${frameCount}: ${JSON.stringify(poseResults)}`);
    frameCount++;
  });

  // Handle errors and exit events from the FFMPEG process
  ffmpeg.stderr.on('data', (data) => {
    console.error(`FFMPEG error: ${data}`);
  });

  ffmpeg.on('exit', (code) => {
    console.log(`FFMPEG process exited with code ${code}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`FFMPEG error: ${err}`);
  });
};
**/


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