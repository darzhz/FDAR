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
