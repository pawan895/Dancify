import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import React, { useRef, useState, useEffect, useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import backend from '@tensorflow/tfjs-backend-webgl';
import Webcam from 'react-webcam';
import ReactPlayer from 'react-player';
import styled from 'styled-components';
import LoadingOverlay from '@ronchalant/react-loading-overlay'
import { POINTS, keypointConnections } from '../Helper/data'
import { drawPoint, drawSegment, computescore } from '../Helper/functions';
import styledComponents from 'styled-components';
import Modal from 'react-overlays/Modal';
import Plot from 'react-plotly.js';
import { PurpleButton } from '../Components/NavBar';


//StyledComponents

const H3 = styled.h3`
color: white;
font-size:25px;

`
const Button = styled.button`
background-color: #d0d8fa;
border: none;
color: black;
padding: 10px 50px;
text-align: center;
font-size: 20px;
text-decoration: none;
display: inline-block;
margin: 20px ;
cursor: pointer;
border-radius: 200px;`

const H1 = styled.h1`
background: #FFFFFF;
background: linear-gradient(to right, #FFFFFF 0%, #838FFF 90%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;   
font-weight: 400;
font-size: 70px;
font-family: Iceland;
margin: 0px 0px 0px 0px;
text-align: center;
`

//colour of the body skeleton
let skeletonColor = 'rgb(255,255,255)'

let interval
var check = 0;
const initialState = {
  isPlaying: false,
  count: 0
};

var bool = false
var y_points = []
var x_points = []
var totalScore = 0;


function Level1() {
  const location = useLocation();
  var level = location.pathname.split("/")[2];
  level = level.toString();
  const data = require(`../Helper/data/actualgradients${level}.json`)
  const vidurl = `/videos/dance${level}.mp4`

  //for webcam
  const videoConstraints = {
    width: 390,
    height: 700
  };

  //for downloading webcam video
  const mediaRecorderRef = React.useRef(null);
  const [recordedChunks, setRecordedChunks] = React.useState([]);
  const [capturing, setCapturing] = React.useState(false);
  //webcamvid
  const webcamRef = useRef(null)

  //canvas is where body skeleton is displayed
  const canvasRef = useRef(null)

  //to display the score
  const [score, setScore] = useState(0)

  const [over, setOver] = useState(true)

  const [state, dispatch] = useReducer(reducer, initialState);
  const idRef = useRef(0);



  useEffect(() => {
    if (!state.isPlaying) {
      return;
    }
    idRef.current = setInterval(() => dispatch({ type: "increment" }), 100);

    bool = true

    return () => {
      clearInterval(idRef.current);
      idRef.current = 0;
    };
  }, [state.isPlaying]);

  //functions for downloading the video
  const handleStartCaptureClick = React.useCallback(() => {
    setCapturing(true);
    mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
      mimeType: "video/webm"
    });
    mediaRecorderRef.current.addEventListener(
      "dataavailable",
      handleDataAvailable
    );
    mediaRecorderRef.current.start();
  }, [webcamRef, setCapturing, mediaRecorderRef]);

  const handleDataAvailable = React.useCallback(
    ({ data }) => {
      if (data.size > 0) {
        setRecordedChunks((prev) => prev.concat(data));
      }
    },
    [setRecordedChunks]
  );

  const handleStopCaptureClick = React.useCallback(() => {
    mediaRecorderRef.current.stop();
    setCapturing(false);
  }, [mediaRecorderRef, webcamRef, setCapturing]);

  const handleDownload = React.useCallback(() => {
    if (recordedChunks.length) {
      const blob = new Blob(recordedChunks, {
        type: "video/webm"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = url;
      a.download = "react-webcam-stream-capture.webm";
      a.click();
      window.URL.revokeObjectURL(url);
      setRecordedChunks([]);
    }
  }, [recordedChunks]);

  //body tracking
  const runMovenet = async () => {
    //creating config for body tracking
    const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER };
    const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);

    //interval every 100ms for real time body tracking
    interval = setInterval(() => {
      detectPose(detector)
    }, 100)
  }
  //estimate poses detects keypoints and then points, segments are drawn
  const detectPose = async (detector) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video
      const pose = await detector.estimatePoses(video)
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      try {
        const keypoints = pose[0].keypoints
        if (bool) {
          var score = computescore(keypoints, state.count, data)
          var modifiedScore = 1000 - score
          totalScore += score;
          setScore(score)
          y_points.push(modifiedScore)
        }
        check++;
        if (check == 1) {
          dispatch({ type: "start" });
          check++;
        }

        keypoints.map((keypoint) => {
          //Drawing the points and segments
          if (keypoint.score > 0.4) {
            drawPoint(ctx, keypoint.x, keypoint.y, 8, 'rgb(255,255,255)')
            let connections = keypointConnections[keypoint.name]
            try {
              connections.forEach((connection) => {
                let conName = connection.toUpperCase()
                drawSegment(ctx, [keypoint.x, keypoint.y],
                  [keypoints[POINTS[conName]].x,
                  keypoints[POINTS[conName]].y]
                  , skeletonColor)
              })
            } catch (err) { }
          }
        });

      } catch (err) {
        console.log(err)
      }
    }
  }

  function reducer(state, action) {
    switch (action.type) {
      case "start": {
        return { ...state, isPlaying: true };
      }
      case "stop":
        return { ...state, isPlaying: false };
      case "increment": {
        return { ...state, count: state.count + 1 };
      }
      default:
        throw new Error();
    }
  }

  //calls movenet which basically starts the entire thing
  function startMovenet() {
    setOver(false)
    runMovenet()
    handleStartCaptureClick()
  }

  function stopMovenet() {
    setOver(true)
    clearInterval(interval)
    console.log(totalScore);
    dispatch({ type: "stop" })
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    handleStopCaptureClick()
    for (let x = 0; x < y_points.length; x++) {
      x_points.push(x)
    }
    setShow(true)
  }

  function getFeedback(totalScore) {
    if (totalScore < 50000) {
      return "Well done! You can move on to the next level"
    } else if (totalScore < 80000) {
      return "Not bad. You still need more practice on this level."
    } else {
      return "Poor performance. Keep practicing or level down."
    }
  }

  const Backdrop = styled("div")`
  position: fixed;
  z-index: 1040;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #d6d3a6;
  opacity: 0.5;
`;


  const RandomlyPositionedModal = styled(Modal)`
  position: fixed;
  width: 500px;
  z-index: 1040;
  top: 25%;
  left: 30%;
  border: 1px solid #e5e5e5;
  background-color: white;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
  padding: 20px;
`;

  const [show, setShow] = useState(false);

  const renderBackdrop = (props) => <Backdrop {...props} />;

  return (
    <>
      <LoadingOverlay
        active={(!state.isPlaying) && (!over)}
        spinner
        text='Dance like no one is watching!'
      >
        <RandomlyPositionedModal
          show={show}
          onHide={() => setShow(false)}
          renderBackdrop={renderBackdrop}
          aria-labelledby="modal-label"
        >
          <div>
            <H3 style={{ color: "black" }}>Result: {getFeedback(totalScore)}</H3>
            <Plot
              data={[
                {
                  x: x_points,
                  y: y_points,
                  type: 'scatter',
                  marker: { color: 'red' },
                },
              ]}
              layout={{ width: 500, height: 500, title: 'Performance!' }}
            />
          </div>
        </RandomlyPositionedModal>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <H1>{"Level " + level}</H1>
          <div className='flex justify-between my-8'>
            {over && <button onClick={startMovenet} className='bg-purple hover:bg-fuchsia-400 text-white font-medium py-2 px-4 rounded-lg my-2  '>Start Level</button>}
            <div>
              <form className="bg-darkblue mt-2 p-0 border border-purple rounded-md flex flex-row-reverse">
                <input
                  type="email"
                  className="w-4/5 px-2 py-0 outline-none rounded-r-md text-white bg-darkBlue border-purple"
                  placeholder={score}

                />
                <button

                  className="w-2/5 py-2 px-4 bg-purple text-white rounded"
                  disabled
                >
                  Score
                </button>
              </form>
            </div>



            {recordedChunks.length > 0 && (

              <button onClick={handleDownload} className='bg-purple hover:bg-fuchsia-400 text-white font-medium py-2 px-4 rounded-lg my-2  '>Download</button>

            )}
          </div>

          <div className="flex flex-col justify-center gap-10 lg:flex-row">
            <div className="Videocontainer border-8 border-purple p-5 lg:border-5 aspect-w-16 aspect-h-9" style={{ width: '600px', height: '500px', overflow: 'hidden' }}>
              <div className="player-wrapper max-w-md ">
                <div className="aspect-w-16 aspect-h-9">
                  <ReactPlayer
                    className="react-player"
                    url={vidurl}
                    width="100%"
                    height="60%"
                    controls={true}
                    onEnded={stopMovenet}
                    playing={state.isPlaying}
                  />

                </div>

              </div>
            </div>
            <div className="Videocontainer border-8 border-purple p-5 lg:border-5 aspect-w-16 aspect-h-9" style={{ width: '600px', height: '500px', overflow: 'hidden' }}>

              <div className="player-wrapper max-w-md ">
                <div className="aspect-w-16 aspect-h-9">

                  <Webcam
                    videoConstraints={videoConstraints}
                    ref={webcamRef}
                    className="mb-4"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <canvas
                    ref={canvasRef}
                    id="my-canvas"
                    width={videoConstraints.width}
                    height={videoConstraints.height}
                    className="mb-4"
                    style={{ transform: "scaleX(-1)" }}
                  ></canvas>
                </div>

              </div>

            </div>
          </div>

        </div>


      </LoadingOverlay>
    </>
  )
}

export default Level1