const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const MAX_PLAYERS = 5;
const ROOM_CODE_LENGTH = 6;

// ============================================================
// SALAS
// ============================================================

const rooms = new Map();


// ============================================================
// SERVIDOR HTTP
// ============================================================

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "text/plain"
        });

        res.end("Still Missing Server Online");
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});


// ============================================================
// WEBSOCKET
// ============================================================

const wss = new WebSocket.Server({
    server
});


// ============================================================
// GERAR CÓDIGO DA SALA
// ============================================================

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
            const index = Math.floor(Math.random() * characters.length);
            code += characters[index];
        }

    } while (rooms.has(code));

    return code;
}


// ============================================================
// ENVIAR JSON
// ============================================================

function send(socket, data) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}


// ============================================================
// AVISAR TODOS DA SALA
// ============================================================

function broadcastRoom(room, data) {
    for (const player of room.players) {
        send(player.socket, data);
    }
}


// ============================================================
// CONEXÃO DE NOVO JOGADOR
// ============================================================

wss.on("connection", (socket) => {

    console.log("Novo jogador conectado.");

    socket.roomCode = null;
    socket.playerId = null;


    // --------------------------------------------------------
    // CONEXÃO CONFIRMADA
    // --------------------------------------------------------

    send(socket, {
        type: "connected",
        message: "Conectado ao servidor do Still Missing."
    });


    // --------------------------------------------------------
    // RECEBER MENSAGEM
    // --------------------------------------------------------

    socket.on("message", (data) => {

        try {

            const message = JSON.parse(data.toString());

            console.log("Recebido:", message);


            // =================================================
            // CRIAR SALA
            // =================================================

            if (message.type === "create_room") {

                // Jogador já está em uma sala
                if (socket.roomCode !== null) {
                    send(socket, {
                        type: "error",
                        message: "Você já está em uma sala."
                    });

                    return;
                }


                const roomCode = generateRoomCode();

                const playerId = Math.random()
                    .toString(36)
                    .substring(2, 10);


                const room = {
                    code: roomCode,
                    players: []
                };


                room.players.push({
                    id: playerId,
                    socket: socket,
                    nickname: message.nickname || "Jogador"
                });


                rooms.set(roomCode, room);


                socket.roomCode = roomCode;
                socket.playerId = playerId;


                console.log(`Sala criada: ${roomCode}`);


                send(socket, {
                    type: "room_created",
                    room_code: roomCode,
                    player_id: playerId,
                    player_count: room.players.length
                });


                return;
            }


            // =================================================
            // ENTRAR EM SALA
            // =================================================

            if (message.type === "join_room") {

                if (socket.roomCode !== null) {
                    send(socket, {
                        type: "error",
                        message: "Você já está em uma sala."
                    });

                    return;
                }


                const roomCode = String(message.room_code || "")
                    .toUpperCase();


                const room = rooms.get(roomCode);


                // Sala não existe
                if (!room) {

                    send(socket, {
                        type: "error",
                        message: "Sala não encontrada."
                    });

                    return;
                }


                // Sala cheia
                if (room.players.length >= MAX_PLAYERS) {

                    send(socket, {
                        type: "error",
                        message: "A sala está cheia."
                    });

                    return;
                }


                const playerId = Math.random()
                    .toString(36)
                    .substring(2, 10);


                const player = {
                    id: playerId,
                    socket: socket,
                    nickname: message.nickname || "Jogador"
                };


                room.players.push(player);


                socket.roomCode = roomCode;
                socket.playerId = playerId;


                console.log(
                    `Jogador entrou na sala ${roomCode}: ${player.nickname}`
                );


                // Resposta para quem entrou
                send(socket, {
                    type: "room_joined",
                    room_code: roomCode,
                    player_id: playerId,
                    player_count: room.players.length
                });


                // Atualizar todos da sala
                broadcastRoom(room, {
                    type: "room_updated",
                    room_code: roomCode,
                    player_count: room.players.length,
                    players: room.players.map((p) => ({
                        id: p.id,
                        nickname: p.nickname
                    }))
                });


                return;
            }


            // =================================================
            // PEDIR INFORMAÇÕES DA SALA
            // =================================================

            if (message.type === "room_info") {

                if (!socket.roomCode) {

                    send(socket, {
                        type: "error",
                        message: "Você não está em uma sala."
                    });

                    return;
                }


                const room = rooms.get(socket.roomCode);


                if (!room) {
                    return;
                }


                send(socket, {
                    type: "room_info",
                    room_code: room.code,
                    player_count: room.players.length,
                    players: room.players.map((p) => ({
                        id: p.id,
                        nickname: p.nickname
                    }))
                });


                return;
            }


            // =================================================
            // MENSAGEM DESCONHECIDA
            // =================================================

            send(socket, {
                type: "error",
                message: "Tipo de mensagem desconhecido."
            });

        } catch (error) {

            console.log("Erro ao processar mensagem:", error.message);

            send(socket, {
                type: "error",
                message: "Mensagem inválida."
            });
        }
    });


    // ========================================================
    // JOGADOR DESCONECTOU
    // ========================================================

    socket.on("close", () => {

        console.log("Jogador desconectado.");

        if (!socket.roomCode) {
            return;
        }


        const room = rooms.get(socket.roomCode);


        if (!room) {
            return;
        }


        room.players = room.players.filter(
            (player) => player.socket !== socket
        );


        // Avisar quem ficou
        broadcastRoom(room, {
            type: "player_left",
            player_id: socket.playerId,
            player_count: room.players.length,
            players: room.players.map((p) => ({
                id: p.id,
                nickname: p.nickname
            }))
        });


        // Se não sobrou ninguém, apagar sala
        if (room.players.length === 0) {

            rooms.delete(room.code);

            console.log(`Sala removida: ${room.code}`);

        } else {

            console.log(
                `Jogador saiu da sala ${room.code}. Restam ${room.players.length}.`
            );
        }
    });


    // ========================================================
    // ERRO
    // ========================================================

    socket.on("error", (error) => {
        console.log("Erro WebSocket:", error.message);
    });
});


// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
