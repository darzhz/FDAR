  drawNoSignal();
 const socket = io('ws://localhost:3001/');
  socket.on('connect',()=>{
  	console.log("connected");
  	const canvas = document.getElementById('canvas');
		canvas.height = 240;
		canvas.width = 320;
		const context = canvas.getContext('2d');
		const imageData = context.createImageData(canvas.width, canvas.height);
		const frameData = new Uint8ClampedArray(canvas.width * canvas.height * 3); // Allocate memory once for RGB data
		const pixelCount = canvas.width * canvas.height;
  socket.on('pose', function(data) {
  console.log(data);
  let rgb = new Uint8ClampedArray(data[1]);
  frameData.set(rgb);
  rgb = null;
  for (let i = 0; i < pixelCount; i++) {
    const r = frameData[i * 3];
    const g = frameData[i * 3 + 1];
    const b = frameData[i * 3 + 2];
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  if (data[0]) {
    context.fillStyle = "rgb(175, 176, 172)";
    context.beginPath();
    context.fill();
    for (let i = 0; i < data[0].keypoints.length; i++) {
      context.fillStyle = "rgb(255, 0, 0)";
      context.beginPath();
      context.ellipse(data[0].keypoints[i].x,data[0].keypoints[i].y, 16, 16, 0, 0, 2 * Math.PI);
      context.fill();
    }
  }

    //let frame = new VideoFrame(msg);
  });
  socket.on('disconnect',drawNoSignal());
  socket.on('label',(data)=>{
      context.font = "50px Arial";
      context.fillText(data, 10, 50);
  });
  });
  function drawNoSignal(){
    const canvas = document.getElementById('canvas');
    canvas.height = 240;
    canvas.width = 360;
    const context = canvas.getContext('2d');
    const img = new Image();
    img.src = './signal.svg';
    img.onload = () => {context.drawImage(img, 0, 0,340,215);
    context.font = "15px monospace";
    context.fillStyle = "rgb(255, 0, 0)";
    context.fillText("Check Connection", canvas.width/2-80, canvas.height-2);
  }
}
async function drawActivityBar(){
  let et = Date.now();
  let st = et - (604800000); //an Hour before in ms
  let myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  let urlencoded = new URLSearchParams();
  urlencoded.append("startTime",`${st}`);
  urlencoded.append("endTime",`${et}`);
  let requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: urlencoded,
    redirect: 'follow'
  };
  let resp =  await fetch('/timeline', requestOptions);
      debugger;
      resp.json().then(async (res)=>{
          let labels = await buildHisto(res);
          console.log(labels)
          let span = Object.keys(labels);
          span.forEach((key)=>{
            //reset height for(let i= 0;i<a.length;i++){a[i].style.height = "0%"}
            let doc = document.querySelector('[title='+key+']');
            doc.style.height = `${labels[key]}%`;
          });
    });

}
async function drawTimeLine(){
  let date = document.getElementById('date').value;
  let timeStart = document.getElementById('timeStart').value;
  let timeEnd = document.getElementById('timeEnd').value;
  let et = Math.round(new Date(date+" "+timeEnd).getTime());
  let st = Math.round(new Date(date+" "+timeStart).getTime());
  if(date&&timeStart&&timeEnd){
    let myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    let urlencoded = new URLSearchParams();
    urlencoded.append("startTime",`${st}`);
    urlencoded.append("endTime",`${et}`);
    let requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: urlencoded,
      redirect: 'follow'
    };
    let resp =  await fetch('/timeline', requestOptions);
        resp.json().then(async (res)=>{
           /** we have a ton of labels in res i want to convert it into an array of object
               like [{x:timestamp,y:label},.....] **/
              console.log(res);
               // let timeStep = await (res.length/(et-st))*1000;
               // let timeFrame = st;
               // console.log(timeStep,res.length,timeFrame);
               let data = [];
               for(let i = 0;i<res.length;i++){
                  debugger;
                 let time = res[i]["time"];
                 let pose = res[i]["pose"];
                 data.push({x:new Date(time).toISOString().slice(11, 19),y:pose});
               }
               // console.log(data);
               drawTimelineChart(removeDuplicates(data));
               });
   }
 }
 function removeDuplicates(arr) {
    return arr.filter((item,
        index) => arr.indexOf(item) === index);
}
function buildHisto(data){
  let labels = {};
  let vals = [];
  for(let i = 0;i<data.length;i++){
      if(data[i]==null)
          continue;
      labels[data[i]["pose"]] = labels[data[i]["pose"]] != undefined?parseInt(labels[data[i]["pose"]])+1:1;
  }
  Object.values(labels).forEach((elem)=>{vals.push(Math.round(elem/data.length*100))})
  let keys = Object.keys(labels)
  for(let i = 0;i<vals.length;i++){
    labels[keys[i]] = vals[i];
  }
  return labels;
}

