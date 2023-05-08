const express = require("express");
const ffmpeg = require('fluent-ffmpeg');
const tf = require('@tensorflow/tfjs');
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require('socket.io')(server);
const Jimp = require('jimp');
app.use(express.static('./'));
async function loadModel() {
  const modelUrl = 'http://localhost:3001/model.json'; 
  const model = await tf.loadGraphModel(modelUrl);
  console.log("model Loaded");
  return model;
}
const poseEstimation = async (model,rtspUrl) => {

  io.on('connect', (socket) => {
    console.log(`Client ${socket.id} connected`);
    
    // // Create an FFMPEG input stream
    // const inputStream = ffmpeg(rtspUrl).inputOptions(['-rtsp_transport', 'tcp']);

    // // Create an FFMPEG output stream
    // const outputStream = inputStream.outputOptions([
    // '-f', 'image2pipe',
    // '-pix_fmt', 'rgb24',
    // '-vcodec', 'rawvideo']);

    const outputStream = ffmpeg(rtspUrl)
  .inputOptions(['-rtsp_transport','tcp'])
  .on('start', (data) => {
    console.log('FFMPEG started');
    console.log(data);
  })
  .on('error', (err) => {
    console.error('FFMPEG error:', err);
  })
  .outputOptions([
    '-f', 'image2pipe',
    '-pix_fmt', 'rgb24',
    '-s' , '640x480',
    '-vcodec', 'rawvideo','-vf', 'scale=640:480'])
  .pipe();

    // Set up the output stream to pipe its data to the pose estimation function
    let frameCount = 0;
    outputStream.on('data', async (data) => {
      // Convert the data buffer to a Uint8Array
       console.log('Received data chunk: ' + data.length);
       //const frame = Buffer.from(data);
      const frame = new Uint8Array(data);
      // const resizedImage = await Jimp.read(frame)
      // .then((image) => image.resize(640, 480));
      //.then((image) => image.getBufferAsync(Jimp.MIME_JPEG));


      // Prepare the input tensor
      // const imageTensor = tf.tensor3d(resizedImage, [480, 640, 3], 'int32');
      // const inputTensor = imageTensor.expandDims();

      // // Run the model inference
      // const outputTensor = model.execute(inputTensor);
      // const predictions = await outputTensor.array();

      // // Convert the output to a more readable format
      // const poseResults = predictions.map((pose) => ({
      //   score: pose[0],
      //   keypoints: pose.slice(1).map((keypoint) => ({
      //     name: keypoint[0],
      //     position: [keypoint[1], keypoint[2]],
      //     score: keypoint[3]
      //   }))
      // }));

      // Send the pose estimation results to the client
      socket.emit('pose', frame);

      // Log the pose estimation results
      console.log(`Frame ${frameCount}: ${JSON.stringify(data.length)}`);
      frameCount++;
    });

    // Start the FFMPEG process
    //outputStream.run();

    // Handle errors from the FFMPEG process
    outputStream.on('error', (err, stdout, stderr) => {
      console.error(`FFMPEG error: ${err}`);
      console.error(`FFMPEG stdout: ${stdout}`);
      console.error(`FFMPEG stderr: ${stderr}`);
    });

    // Set up the Socket.IO connection to listen for a "disconnect" event from the client
    socket.on('disconnect', () => {
      console.log(`Client ${socket.id} disconnected`);
      //outputStream.kill();
    });
  });
};
//poseEstimation('rtsp://192.168.1.5:8080/h264_ulaw.sdp')
loadModel().then((model) => {
  poseEstimation(model,'rtsp://192.168.1.3:8080/h264_ulaw.sdp');
})
const port = 3001;
  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });