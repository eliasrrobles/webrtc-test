import {
    useEffect,
    useRef,
    useState
} from "react";

import { socket } from "./socket";
import { peer } from "./rtc";


const ROOM = "test";


export default function App() {


    const localAudio = useRef(null);
    const remoteAudio = useRef(null);
    const remoteVideo = useRef(null);


    const [stats, setStats] = useState({

        send: {
            bitrate: 0,
            fps: 0,
            lost: 0
        },

        recv: {
            bitrate: 0,
            fps: 0,
            lost: 0
        },

        capture: {
            fps: 0,
            width: 0,
            height: 0
        }

    });





    useEffect(() => {


        peer.ontrack = event => {


            if (event.track.kind === "audio") {

                remoteAudio.current.srcObject =
                    event.streams[0];

            }


            if (event.track.kind === "video") {

                remoteVideo.current.srcObject =
                    event.streams[0];

            }

        };





        peer.onicecandidate = event => {

            if (event.candidate) {

                socket.emit(
                    "ice-candidate",
                    {
                        room: ROOM,
                        candidate: event.candidate
                    }
                );

            }

        };







        peer.onnegotiationneeded = async () => {


            const offer =
                await peer.createOffer();


            await peer.setLocalDescription(
                offer
            );


            socket.emit(
                "offer",
                {
                    room: ROOM,
                    offer
                }
            );


        };





        socket.emit(
            "join-room",
            ROOM
        );





        socket.on(
            "make-offer",
            async () => {


                const offer =
                    await peer.createOffer();


                await peer.setLocalDescription(
                    offer
                );


                socket.emit(
                    "offer",
                    {
                        room: ROOM,
                        offer
                    }
                );

            }
        );







        socket.on(
            "offer",
            async offer => {


                await peer.setRemoteDescription(
                    offer
                );


                const answer =
                    await peer.createAnswer();


                await peer.setLocalDescription(
                    answer
                );


                socket.emit(
                    "answer",
                    {
                        room: ROOM,
                        answer
                    }
                );

            }
        );






        socket.on(
            "answer",
            async answer => {

                await peer.setRemoteDescription(
                    answer
                );

            }
        );







        socket.on(
            "ice-candidate",
            async candidate => {

                try {

                    await peer.addIceCandidate(
                        candidate
                    );

                } catch(e) {

                    console.log(e);

                }

            }
        );



        startStats();



    }, []);









    async function start() {


        const stream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: {

                        echoCancellation:true,
                        noiseSuppression:true,
                        autoGainControl:true

                    },

                    video:false

                });





        localAudio.current.srcObject =
            stream;





        stream.getTracks()
            .forEach(track => {

                peer.addTrack(
                    track,
                    stream
                );

            });

    }









    async function shareScreen() {



        const screen =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: {

                        width: {
                            ideal:1920,
                            max:1920
                        },

                        height:{
                            ideal:1080,
                            max:1080
                        },

                        frameRate:{
                            ideal:30,
                            max:30
                        }

                    },

                    audio:false

                });






        const videoTrack =
            screen.getVideoTracks()[0];



        console.log(
            "captura:",
            videoTrack.getSettings()
        );






        peer.addTrack(
            videoTrack,
            screen
        );






        const sender =
            peer.getSenders()
                .find(
                    s =>
                        s.track &&
                        s.track.kind === "video"
                );




        if(sender){


            const params =
                sender.getParameters();



            params.encodings = [
                {
                    maxBitrate:5000000,
                    maxFramerate:30
                }
            ];



            try {

                await sender.setParameters(
                    params
                );


            } catch(e){

                console.log(
                    "setParameters error",
                    e
                );

            }

        }






        const settings =
            videoTrack.getSettings();




        setStats(old => ({

            ...old,

            capture:{

                fps:
                    Math.round(
                        settings.frameRate || 0
                    ),

                width:
                    settings.width || 0,


                height:
                    settings.height || 0

            }

        }));


    }









    function startStats(){


        let lastSendBytes = 0;
        let lastRecvBytes = 0;

        let lastTime =
            performance.now();




        setInterval(async()=>{


            const reports =
                await peer.getStats();




            let send={
                bitrate:0,
                fps:0,
                lost:0
            };


            let recv={
                bitrate:0,
                fps:0,
                lost:0
            };




            const now =
                performance.now();


            const seconds =
                (now-lastTime)/1000;






            reports.forEach(r=>{



                if(
                    r.type==="outbound-rtp" &&
                    r.kind==="video"
                ){


                    send.bitrate =
                        Math.round(
                            ((r.bytesSent-lastSendBytes)*8)
                            /
                            seconds
                            /
                            1000
                        );


                    send.fps =
                        Math.round(
                            r.framesPerSecond || 0
                        );


                    send.lost =
                        r.packetsLost || 0;



                    lastSendBytes =
                        r.bytesSent;

                }






                if(
                    r.type==="inbound-rtp" &&
                    r.kind==="video"
                ){


                    recv.bitrate =
                        Math.round(
                            ((r.bytesReceived-lastRecvBytes)*8)
                            /
                            seconds
                            /
                            1000
                        );


                    recv.fps =
                        Math.round(
                            r.framesPerSecond || 0
                        );


                    recv.lost =
                        r.packetsLost || 0;



                    lastRecvBytes =
                        r.bytesReceived;

                }



            });




            lastTime =
                now;




            setStats({

                send,
                recv,
                capture:stats.capture

            });



        },1000);

    }









    return (

        <div
            style={{
                background:"#202225",
                color:"white",
                padding:30,
                minHeight:"100vh"
            }}
        >


            <h1>
                RTC Discord Test
            </h1>



            <button onClick={start}>
                Entrar llamada
            </button>



            <button onClick={shareScreen}>
                Compartir pantalla
            </button>





            <h2>
                Pantalla remota
            </h2>



            <video
                ref={remoteVideo}
                autoPlay
                playsInline
                style={{
                    width:"800px",
                    background:"black"
                }}
            />




            <audio
                ref={localAudio}
                autoPlay
                muted
            />



            <audio
                ref={remoteAudio}
                autoPlay
            />






            <hr/>




            <h2>
                Enviando
            </h2>


            <p>
                Bitrate:
                {stats.send.bitrate} kbps
            </p>


            <p>
                FPS:
                {stats.send.fps}
            </p>


            <p>
                Perdidos:
                {stats.send.lost}
            </p>





            <h2>
                Recibiendo
            </h2>


            <p>
                Bitrate:
                {stats.recv.bitrate} kbps
            </p>


            <p>
                FPS:
                {stats.recv.fps}
            </p>


            <p>
                Perdidos:
                {stats.recv.lost}
            </p>





            <h2>
                Captura
            </h2>


            <p>
                Resolución:
                {stats.capture.width}
                x
                {stats.capture.height}
            </p>


            <p>
                FPS captura:
                {stats.capture.fps}
            </p>


        </div>

    );

}