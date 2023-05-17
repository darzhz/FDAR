const express = require("express");
const ffmpeg = require('fluent-ffmpeg');
const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const path = require("path");
const app = express();
const server = require("http").createServer(app);
const io = require('socket.io')(server);
const poseDetection = require('@tensorflow-models/pose-detection');
const redis = require('redis');
var bodyParser = require('body-parser')
const client = redis.createClient();
const { v4: uuidv4 } = require('uuid')
const width = 320;
const height = 240;
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

app.use(express.static('./client'));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.post('/timeline',async (req,res) => {
   let data = req.body;
   console.log(data);
   let poses = await getData(data.startTime,data.endTime);
   console.log(poses);
   res.send(await JSON.stringify(poses));
});
app.post('/test',async (req,res) => {
   let data = req.body;
   console.log(data);
   //let poses = await getData(data.startTime,data.endTime);
   let time = data.endTime - data.startTime;
   let poses = [];
   for(let i = 0;i < time;i++){
    let randomNumber  = Math.floor(Math.random() * 10)%11;
    poses[i] = labels[randomNumber];
   }
   console.log('generated poses' +poses.length);
   res.send(await JSON.stringify(poses));
});

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
       //console.log('Received data chunk: ' + data.length);
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
                    //disposesing all the tensors
                    inputTensor.dispose();
                    flattenedInput.dispose();
                    result.dispose();
                    imageTensor.dispose();
                    console.log(tf.memory());
                    socket.emit('label',predictedLabel);
                    setData(predictedLabel);
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
  poseEstimation(model,'rtsp://192.168.1.4:8080/h264_ulaw.sdp',width,height);
})
}
const port = 3001;
  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});

// connect database
async function initializeDb(){
  client.on('error', err => console.log('Redis Client Error', err));
  await client.connect();
  console.log('db connected');
}
async function setData(poseData){
 const timestamp = Date.now();
 const uuid = uuidv4();
 const data = JSON.stringify(poseData);
if(poseData && timestamp){
client.zAdd('poses', {score:timestamp,value:uuid}).then(async (ok, err) => {
  if (err) {
    console.error(err);
  } else {
    const poseDataKey = `pose:${uuid}`;
    await client.SET(poseDataKey, data);
    console.log(`Pose data stored in Redis with timestamp ${String(timestamp)}`);
  }
});
}
}
async function getData(startTime,endTime){
return client.sendCommand(['ZRANGEBYSCORE','poses', startTime, endTime]).then(async (uuids, err) => {
  if (err) {
    console.error(err);
  } else {
    const poseDataKeys = await uuids.map(uuid => `pose:${uuid}`);
    console.log(poseDataKeys);
    if(poseDataKeys.length > 1){
    return client.sendCommand(['MGET',...poseDataKeys]).then(async (poseDataList,err) => {
      if (err) {
        console.error(err);
      } else {
        const poses = poseDataList.map(poseDataStr => JSON.parse(poseDataStr));
        return poses
      }
    });
    }
  }
});
}
initializeDb();
