import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL
}));

const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL
    }
});


const rooms = {};


io.on("connection", socket => {


    console.log(
        "connected",
        socket.id
    );



    socket.on(
        "join-room",
        room => {


            socket.join(room);


            if (!rooms[room]) {
                rooms[room] = [];
            }


            rooms[room].push(
                socket.id
            );


            console.log(
                room,
                rooms[room]
            );



            if (
                rooms[room].length === 2
            ) {

                io.to(
                    rooms[room][0]
                )
                    .emit(
                        "make-offer"
                    );

            }


        }
    );




    socket.on(
        "offer",
        ({ room, offer }) => {

            socket.to(room)
                .emit(
                    "offer",
                    offer
                );

        }
    );




    socket.on(
        "answer",
        ({ room, answer }) => {

            socket.to(room)
                .emit(
                    "answer",
                    answer
                );

        }
    );





    socket.on(
        "ice-candidate",
        ({ room, candidate }) => {

            socket.to(room)
                .emit(
                    "ice-candidate",
                    candidate
                );

        }
    );





    socket.on(
        "disconnect",
        () => {

            Object.keys(rooms)
                .forEach(room => {


                    rooms[room] =
                        rooms[room]
                            .filter(
                                id =>
                                    id !== socket.id
                            );


                });


        }
    );


});



server.listen(
    process.env.PORT, () => {
        console.log(
            "RTC server running"
        );
    }
);