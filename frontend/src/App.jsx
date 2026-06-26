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
        peer.ontrack =
            event => {


                console.log(
                    "track remoto:",
                    event.track.kind
                );


                if (
                    event.track.kind === "audio"
                ) {

                    remoteAudio.current.srcObject =
                        event.streams[0];

                }



                if (
                    event.track.kind === "video"
                ) {

                    remoteVideo.current.srcObject =
                        event.streams[0];

                }


            };






        peer.onicecandidate =
            event => {


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







        peer.onnegotiationneeded =
            async () => {


                console.log(
                    "renegociando"
                );



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


                } catch (e) {

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

                        echoCancellation: true,

                        noiseSuppression: true,

                        autoGainControl: true

                    },

                    video: false

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
                            ideal: 1920
                        },


                        height: {
                            ideal: 1080
                        },


                        frameRate: {

                            ideal: 60,

                            max: 60

                        }


                    },


                    audio: true


                });





        const videoTrack =
            screen.getVideoTracks()[0];



        console.log(
            "captura:",
            videoTrack.getSettings()
        );




        screen.getTracks()
            .forEach(track => {


                peer.addTrack(
                    track,
                    screen
                );


            });






        const sender =
            peer.getSenders()
                .find(
                    s =>
                        s.track &&
                        s.track.kind === "video"
                );


        if (sender) {

            const params =
                sender.getParameters();


            params.encodings =
                params.encodings.map(enc => ({

                    ...enc,

                    maxFramerate: 60,

                    maxBitrate: 6000000

                }));


            try {

                await sender.setParameters(
                    params
                );

            } catch (err) {

                console.log(
                    "No se pudo aplicar bitrate/fps:",
                    err
                );

            }

        }






        const settings =
            videoTrack.getSettings();




        setStats(old => ({

            ...old,

            capture: {

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








    function startStats() {



        let lastSend = 0;
        let lastRecv = 0;


        let lastTime =
            Date.now();




        setInterval(
            async () => {


                const reports =
                    await peer.getStats();




                let send = {

                    bitrate: 0,
                    fps: 0,
                    lost: 0

                };


                let recv = {

                    bitrate: 0,
                    fps: 0,
                    lost: 0

                };






                reports.forEach(report => {





                    if (
                        report.type === "outbound-rtp"
                        &&
                        report.kind === "video"
                    ) {



                        const now =
                            Date.now();


                        const seconds =
                            (
                                now - lastTime
                            ) / 1000;



                        send.bitrate =
                            Math.round(
                                (
                                    (
                                        report.bytesSent - lastSend
                                    )
                                    * 8
                                )
                                /
                                seconds
                                /
                                1000
                            );



                        send.fps =
                            Math.round(
                                report.framesPerSecond || 0
                            );



                        send.lost =
                            report.packetsLost || 0;



                        lastSend =
                            report.bytesSent;


                    }







                    if (
                        report.type === "inbound-rtp"
                        &&
                        report.kind === "video"
                    ) {



                        const now =
                            Date.now();



                        const seconds =
                            (
                                now - lastTime
                            ) / 1000;




                        recv.bitrate =
                            Math.round(
                                (
                                    (
                                        report.bytesReceived - lastRecv
                                    )
                                    * 8
                                )
                                /
                                seconds
                                /
                                1000
                            );




                        recv.fps =
                            Math.round(
                                report.framesPerSecond || 0
                            );




                        recv.lost =
                            report.packetsLost || 0;




                        lastRecv =
                            report.bytesReceived;


                    }



                });




                lastTime =
                    Date.now();





                setStats(old => ({

                    ...old,

                    send,

                    recv

                }));



            }, 1000);


    }









    return (

        <div
            style={{
                background: "#202225",
                color: "white",
                padding: 30,
                minHeight: "100vh"
            }}
        >


            <h1>
                RTC Discord Test
            </h1>


            <button onClick={start}>
                Entrar llamada
            </button>
            <button
                onClick={shareScreen}
            >
                Compartir pantalla 60FPS
            </button>




            <h2>
                Pantalla remota
            </h2>



            <video

                ref={remoteVideo}

                autoPlay

                playsInline

                style={{

                    width: "800px",

                    background: "black"

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





            <hr />




            <h2>
                📤 Enviando
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
                📥 Recibiendo
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
                {" "}
                {stats.capture.width}
                x
                {stats.capture.height}
            </p>


            <p>
                FPS captura:
                {" "}
                {stats.capture.fps}
            </p>



        </div>

    );

}