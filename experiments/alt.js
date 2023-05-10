const express = require("express");
const ffmpeg = require('fluent-ffmpeg');
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require('socket.io')(server);
const poseDetection = require('@tensorflow-models/pose-detection');
const MemoryStream = require('memorystream');
const width = 640;
const height = 480;
const buffersize  = height*width*3;
let posemodel;
const labels = [
  'falling-forward-using-hands',
  'jumping',
  'laying',
  'falling-forward-using-knees',
  'falling-backwards',
  'falling-sideways',
  'falling-siting-in-empty-chair',
  'walking',
  'standing',
  'siting',
  'picking-up-an-object'
];

app.use(express.static('./'));
async function loadModel() {
  // const modelUrl = 'http://localhost:3001/model.json';
  // const model = await tf.loadGraphModel(modelUrl);
  posemodel = await tf.loadGraphModel('http://localhost:3001/tfjs/model.json');
  const model = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        minPoseScore:0.1
        });
  console.log("models Loaded");
  return model;
}


const poseEstimation = async (model,rtspUrl,width,height) => {

  io.on('connect', (socket) => {
    console.log(`Client ${socket.id} connected`);

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
    '-vcodec', 'rawvideo','-bufsize',460800])
  .pipe();

    // Set up the output stream to pipe its data to the pose estimation function
    let frameData = Buffer.alloc(0);
    outputStream.on('data', async (data) => {
      if (frameData === null) { // Check if frameData is null before concatenating it with data
      frameData = Buffer.alloc(0);
      }
      frameData = Buffer.concat([frameData, data]);
       console.log('Received data chunk: ' + data.length);
       if (frameData && frameData.length >= buffersize) {
          if(frameData.length == buffersize){
              const imageTensor = tf.tensor3d(frameData, [height, width, 3], 'int32');
              const predictions = await model.estimatePoses(imageTensor);
              /** experimental section **/
                if(predictions[0]){
                  socket.emit('pose', [predictions[0],frameData]);
                  let inputs = [];
                    for (let i = 0; i < predictions[0].keypoints.length; i++) {
                      let x = predictions[0].keypoints[i].x;
                      let y = predictions[0].keypoints[i].y;
                      let z = predictions[0].keypoints.name;
                      inputs.push(x,y,z);
                    }
                    const inputTensor = tf.tensor3d(inputs, [1, 17, 3], 'float32');
                    const flattenedInput = inputTensor.reshape([-1, 51]);
                    const result = await posemodel.execute({ 'input_1': flattenedInput });
                    const results = await result.array();
                    const labelIndex = results[0].indexOf(Math.max(...results[0]));
                    const predictedLabel = labels[labelIndex];
                    console.log(predictedLabel);
                    socket.emit('label',predictedLabel);
                }
                 /** experimental section ends **/
                //here was emit
              }
            frameData = frameData.slice(buffersize)
        }
    });
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
tf.setBackend('wasm').then(() => main());
function main(){
console.log('wasm loaded');
loadModel().then((model) => {
  poseEstimation(model,'rtsp://192.168.143.116:8080/h264_ulaw.sdp',width,height);
})
}
const port = 3001;
  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
