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
const { Telegraf } = require("telegraf");
require('dotenv').config()
//curl https://api.telegram.org/bot<YourBOTToken>/getUpdates
const  tele = new Telegraf(process.env.TBOT);
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
let hasStarted = false;
app.use(express.static('./client'));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.post('/timeline',async (req,res) => {
   let data = req.body;
   console.log(data);
   let poses = await getData(data.startTime,data.endTime);
   if(poses){
   console.log(poses.filter(n => n));
   res.send(await JSON.stringify(poses.filter(n => n)));
  }else{
    poses = await getDataFromSqlite(data.startTime,data.endTime);
    res.send(await JSON.stringify(poses.filter(n => n)));
  }
});
app.post('/backup',async (req,res) => {
   backupRedisToSQLite();  
   let data = req.body;
   let poses = await getDataFromSqlite(data.startTime,data.endTime);
   res.send(await JSON.stringify("backed up "+poses.length+" items"));
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
        minPoseScore:0.2
        });
  console.log("models Loaded");
  return model;
}
  io.on('connect', (socket) => {
    console.log(`Client ${socket.id} connected`);
    // if(!hasStarted){
    //   tf.setBackend('wasm').then(() => main());
    //   hasStarted = true;
    //   }

     socket.on('disconnect', () => {
      console.log(`Client ${socket.id} disconnected`);

      //outputStream.kill();
    });
  });

const poseEstimation = async (model,rtspUrl,width,height) => {
  
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
      if(!hasStarted)
        outputStream.kill('SIGSTOP');
      if (isProcessing) {
        // Skip frames while processing is in progress
        console.log('frame skipped');
        return;
      }
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
                  console.log(predictions[0].score);
                  io.emit('pose', [predictions[0],frameData]);
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
                    const min = Math.min(...results[0]);
                    const max = Math.max(...results[0]);
                    const normalizedResults = results[0].map((value) => {
                      // Perform normalization on each value
                      const normalizedValue = (value - min) / (max - min);
                      return normalizedValue;
                    });
                    //debugger;
                    const score = Math.max(...normalizedResults)
                    const labelIndex = normalizedResults.indexOf(score);
                    const predictedLabel = labels[labelIndex];
                    console.log(predictedLabel+" with score "+Math.floor(score*100)+"%");
                    //disposesing all the tensors
                    inputTensor.dispose();
                    flattenedInput.dispose();
                    result.dispose();
                    imageTensor.dispose();
                    console.log(tf.memory());
                    io.emit('label',predictedLabel);
                    isProcessing = false;
                    setData(predictedLabel);//setting label to redis
                    if(predictedLabel == labels[0] || predictedLabel == labels[3] || predictedLabel == labels[4] || predictedLabel == labels[5] || predictedLabel == labels[6]){
                       try{
                       await notifyTele('detected abnormal activity :'+predictedLabel+" with score "+Math.floor(score*100)+"%");
                       }catch(err){
                       console.error(err);
                       }
                    }
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
   
    //here was the end of connect
};



//poseEstimation('rtsp://192.168.1.5:8080/h264_ulaw.sdp')
//tf.setBackend('wasm').then(() => main());
tele.command('startdetection', async (ctx) => {
  console.log("start Detection invoked remotely");
  if(!hasStarted){
    //start
    hasStarted = !hasStarted;
    tf.setBackend('wasm').then(() => main());
  }else{
    notifyTele('process already started');
  }
});
tele.command('enddetection', async (ctx) => {
  hasStarted = !hasStarted;
  notifyTele('process stopped');
});
function main(){
console.log('wasm loaded');
loadModel().then((model) => {
  poseEstimation(model,process.env.STREAM,width,height);
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
 const data = JSON.stringify({pose:poseData,time:timestamp});
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

const sqlite3 = require('sqlite3').verbose();
const sqliteFile = 'backup.db';
const backupInterval = 60 * 60 * 1000;
function createTable() {
  // Execute the query to create a table
  const db = new sqlite3.Database(sqliteFile);
  const query = `CREATE TABLE IF NOT EXISTS redis_backup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pose TEXT,
    time INTEGER
  )`;

  db.run(query, err => {
    if (err) {
      console.error('Error creating table in SQLite:', err);
    } else {
      console.log('Table created in SQLite');
    }

    // Close the database connection
    db.close();
  });
}

// Call the function to create a table
createTable();
async function backupRedisToSQLite() {
    const db = new sqlite3.Database(sqliteFile);
    let pose  = await getData('-inf','+inf');
    // Start SQLite transaction
    if(pose != null){
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      console.log(pose);
      // Iterate over Redis keys
      pose.forEach(key => {
        debugger;
        if(key != null){
          console.log(key);
          db.run('INSERT INTO redis_backup (pose, time) VALUES (?, ?)', [JSON.stringify(key.pose), JSON.stringify(key.time)], err => {
            if (err) {
              console.error(`Error inserting key "${key}" into SQLite:`, err);
            }
          });
        }
      });

      // Commit SQLite transaction
      db.run('COMMIT', err => {
        if (err) {
          console.error('Error committing SQLite transaction:', err);
        }
         client.sendCommand(['flushall']);
         db.close();
      });
    });
  }else{
    console.log("no data in redis");
    db.close();
  }
}
async function getDataFromSqlite(startTime, endTime) {
return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqliteFile);
    const query = `SELECT * FROM redis_backup WHERE time BETWEEN ? AND ?`;
    db.all(query, [startTime, endTime], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Close the database connection
        db.close(err => {
          if (err) {
            console.error('Error closing SQLite database connection:', err);
          }
          resolve(rows);
        });
      }
    });
  });
}

// Schedule periodic backup
setInterval(backupRedisToSQLite, backupInterval);
initializeDb();


//notify
async function notifyTele(message){
  await tele.telegram.sendMessage(
    process.env.TUSER,message
  );
}
notifyTele('server started');
tele.startPolling();
process.once('SIGINT', () => tele.stop('SIGINT'));
process.once('SIGTERM', () => tele.stop('SIGTERM'));
