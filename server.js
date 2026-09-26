const http = require("http");
const WebSocket = require("ws");


// ============================================================
// CONFIGURAÇÕES
// ============================================================

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
            "Content-Type": "text/plain; charset=utf-8"
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
// GERAR ID DO JOGADOR
// ============================================================

function generatePlayerId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}


// ============================================================
// GERAR NICKNAME AUTOMÁTICO
// ============================================================

function generateAutomaticNickname() {

    let number;

    do {

        number = Math.floor(
            100 + Math.random() * 900
        );

    } while (
        [...rooms.values()].some((room) =>
            room.players.some(
                (player) =>
                    player.nickname === `Player ${number}`
            )
        )
    );


    return `Player ${number}`;
}


// ============================================================
// PREPARAR NICKNAME
// ============================================================

function getNickname(nickname) {

    if (
        typeof nickname !== "string" ||
        nickname.trim() === ""
    ) {

        return generateAutomaticNickname();
    }


    const cleaned = nickname
        .trim()
        .substring(0, 20);


    if (cleaned === "") {

        return generateAutomaticNickname();
    }


    return cleaned;
}


// ============================================================
// GERAR CÓDIGO DA SALA
// ============================================================

function generateRoomCode() {

    const characters = "0123456789";

    let code;


    do {

        code = "";


        for (
            let i = 0;
            i < ROOM_CODE_LENGTH;
            i++
        ) {

            const index = Math.floor(
                Math.random() * characters.length
            );


            code += characters[index];
        }


    } while (rooms.has(code));


    return code;
}


// ============================================================
// ENVIAR JSON
// ============================================================

function send(socket, data) {

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(data)
        );
    }
}


// ============================================================
// LISTA PÚBLICA DOS JOGADORES
// ============================================================

function getPublicPlayers(room) {

    return room.players.map((player) => {

        return {
            id: player.id,
            nickname: player.nickname,
            role: player.isHost
                ? "HOST"
                : "CLIENTE"
        };
    });
}


// ============================================================
// ENVIAR ESTADO DA SALA
// ============================================================

function broadcastRoomUpdate(room) {

    const players = getPublicPlayers(room);


    for (const player of room.players) {

        send(player.socket, {

            type: "room_updated",

            room_code: room.code,

            player_count: room.players.length,

            max_players: MAX_PLAYERS,

            game_started: room.gameStarted,

            players: players
        });
    }
}


// ============================================================
// AVISAR TODOS DA SALA
// ============================================================

function broadcastRoom(room, data) {

    for (const player of room.players) {

        send(
            player.socket,
            data
        );
    }
}


// ============================================================
// ENCONTRAR JOGADOR
// ============================================================

function getPlayerFromSocket(room, socket) {

    return room.players.find(
        (player) =>
            player.socket === socket
    );
}


// ============================================================
// CRIAR SALA
// ============================================================

function createRoom(socket, requestedNickname) {

    if (socket.roomCode !== null) {

        send(socket, {

            type: "error",

            message:
                "Você já está em uma sala."
        });

        return;
    }


    const roomCode =
        generateRoomCode();


    const playerId =
        generatePlayerId();


    const nickname =
        getNickname(requestedNickname);


    const room = {

        code: roomCode,

        players: [],

        gameStarted: false,

        createdAt: Date.now()
    };


    const player = {

        id: playerId,

        socket: socket,

        nickname: nickname,

        isHost: true
    };


    room.players.push(player);


    rooms.set(
        roomCode,
        room
    );


    socket.roomCode = roomCode;

    socket.playerId = playerId;


    console.log(
        "=================================================="
    );

    console.log(
        `Sala criada por: ${nickname}`
    );

    console.log(
        `Código da sala: ${roomCode}`
    );

    console.log(
        `Jogadores: 1/${MAX_PLAYERS}`
    );

    console.log(
        "=================================================="
    );


    send(socket, {

        type: "room_created",

        room_code: roomCode,

        player_id: playerId,

        nickname: nickname,

        player_count: 1,

        max_players: MAX_PLAYERS,

        game_started: false,

        players: getPublicPlayers(room)
    });
}


// ============================================================
// ENTRAR NA SALA
// ============================================================

function joinRoom(
    socket,
    requestedRoomCode,
    requestedNickname
) {

    if (socket.roomCode !== null) {

        send(socket, {

            type: "error",

            message:
                "Você já está em uma sala."
        });

        return;
    }


    const roomCode =
        String(
            requestedRoomCode || ""
        ).trim();


    if (
        !/^\d{6}$/.test(roomCode)
    ) {

        send(socket, {

            type: "error",

            message:
                "O código da sala deve ter exatamente 6 números."
        });

        return;
    }


    const room =
        rooms.get(roomCode);


    if (!room) {

        send(socket, {

            type: "error",

            message:
                "Sala não encontrada."
        });

        return;
    }


    if (
        room.players.length >=
        MAX_PLAYERS
    ) {

        send(socket, {

            type: "error",

            message:
                "A sala está cheia."
        });

        return;
    }


    if (room.gameStarted) {

        send(socket, {

            type: "error",

            message:
                "A partida já começou."
        });

        return;
    }


    const playerId =
        generatePlayerId();


    const nickname =
        getNickname(requestedNickname);


    const player = {

        id: playerId,

        socket: socket,

        nickname: nickname,

        isHost: false
    };


    room.players.push(player);


    socket.roomCode = roomCode;

    socket.playerId = playerId;


    console.log(
        `Jogador conectado: ${nickname}`
    );

    console.log(
        `${nickname} entrou na sala ${roomCode}`
    );

    console.log(
        `Jogadores: ${room.players.length}/${MAX_PLAYERS}`
    );


    // --------------------------------------------------------
    // RESPOSTA PARA O CLIENTE
    // --------------------------------------------------------

    send(socket, {

        type: "room_joined",

        room_code: roomCode,

        player_id: playerId,

        nickname: nickname,

        player_count:
            room.players.length,

        max_players:
            MAX_PLAYERS,

        game_started:
            room.gameStarted,

        players:
            getPublicPlayers(room)
    });


    // --------------------------------------------------------
    // AVISAR TODOS
    // --------------------------------------------------------

    broadcastRoom(room, {

        type: "player_joined",

        room_code: roomCode,

        player_id: playerId,

        nickname: nickname,

        player_count:
            room.players.length,

        max_players:
            MAX_PLAYERS
    });


    broadcastRoomUpdate(room);
}


// ============================================================
// INICIAR PARTIDA
// ============================================================

function startGame(socket, requestedRoomCode) {

    const roomCode =
        String(
            requestedRoomCode || ""
        ).trim();


    if (
        !/^\d{6}$/.test(roomCode)
    ) {

        send(socket, {

            type: "error",

            message:
                "Código de sala inválido."
        });

        return;
    }


    const room =
        rooms.get(roomCode);


    if (!room) {

        send(socket, {

            type: "error",

            message:
                "Sala não encontrada."
        });

        return;
    }


    const player =
        getPlayerFromSocket(
            room,
            socket
        );


    if (!player) {

        send(socket, {

            type: "error",

            message:
                "Você não está nessa sala."
        });

        return;
    }


    if (!player.isHost) {

        send(socket, {

            type: "error",

            message:
                "Somente o host pode iniciar a partida."
        });

        return;
    }


    if (room.gameStarted) {

        send(socket, {

            type: "error",

            message:
                "A partida já foi iniciada."
        });

        return;
    }


    room.gameStarted = true;


    console.log(
        "=================================================="
    );

    console.log(
        `PARTIDA COMEÇOU`
    );

    console.log(
        `Sala: ${roomCode}`
    );

    console.log(
        `Host: ${player.nickname}`
    );

    console.log(
        `Jogadores: ${room.players.length}/${MAX_PLAYERS}`
    );

    console.log(
        "=================================================="
    );


    broadcastRoom(room, {

        type: "game_started",

        room_code: roomCode,

        player_count:
            room.players.length,

        players:
            getPublicPlayers(room)
    });


    broadcastRoomUpdate(room);
}


// ============================================================
// SAIR DA SALA
// ============================================================

function leaveRoom(socket) {

    if (!socket.roomCode) {

        send(socket, {

            type: "error",

            message:
                "Você não está em uma sala."
        });

        return;
    }


    removePlayerFromRoom(
        socket,
        true
    );
}


// ============================================================
// REMOVER JOGADOR
// ============================================================

function removePlayerFromRoom(
    socket,
    notifySocket
) {

    const roomCode =
        socket.roomCode;


    if (!roomCode) {
        return;
    }


    const room =
        rooms.get(roomCode);


    if (!room) {

        socket.roomCode = null;
        socket.playerId = null;

        return;
    }


    const playerIndex =
        room.players.findIndex(
            (player) =>
                player.socket === socket
        );


    if (playerIndex === -1) {

        socket.roomCode = null;
        socket.playerId = null;

        return;
    }


    const removedPlayer =
        room.players[playerIndex];


    const wasHost =
        removedPlayer.isHost;


    room.players.splice(
        playerIndex,
        1
    );


    console.log(
        `${removedPlayer.nickname} saiu da sala ${roomCode}`
    );


    // --------------------------------------------------------
    // HOST SAIU
    // --------------------------------------------------------

    if (wasHost) {

        // Se ainda existem jogadores,
        // escolher um novo host.

        if (room.players.length > 0) {

            room.players[0].isHost = true;


            console.log(
                `${room.players[0].nickname} agora é o novo host da sala ${roomCode}`
            );


            broadcastRoom(room, {

                type: "host_changed",

                room_code: roomCode,

                player_id:
                    room.players[0].id,

                nickname:
                    room.players[0].nickname
            });

        }
    }


    // --------------------------------------------------------
    // AVISAR QUEM SAIU
    // --------------------------------------------------------

    if (notifySocket) {

        send(socket, {

            type: "left_room",

            room_code: roomCode
        });
    }


    // --------------------------------------------------------
    // LIMPAR CONEXÃO
    // --------------------------------------------------------

    socket.roomCode = null;
    socket.playerId = null;


    // --------------------------------------------------------
    // SALA VAZIA
    // --------------------------------------------------------

    if (room.players.length === 0) {

        rooms.delete(roomCode);


        console.log(
            `Sala removida: ${roomCode}`
        );


        return;
    }


    // --------------------------------------------------------
    // AVISAR RESTANTES
    // --------------------------------------------------------

    broadcastRoom(room, {

        type: "player_left",

        room_code: roomCode,

        player_id:
            removedPlayer.id,

        nickname:
            removedPlayer.nickname,

        player_count:
            room.players.length,

        max_players:
            MAX_PLAYERS
    });


    broadcastRoomUpdate(room);
}


// ============================================================
// INFORMAÇÕES DA SALA
// ============================================================

function sendRoomInfo(socket) {

    if (!socket.roomCode) {

        send(socket, {

            type: "error",

            message:
                "Você não está em uma sala."
        });

        return;
    }


    const room =
        rooms.get(
            socket.roomCode
        );


    if (!room) {

        send(socket, {

            type: "error",

            message:
                "Sala não encontrada."
        });

        return;
    }


    send(socket, {

        type: "room_info",

        room_code: room.code,

        player_count:
            room.players.length,

        max_players:
            MAX_PLAYERS,

        game_started:
            room.gameStarted,

        players:
            getPublicPlayers(room)
    });
}


// ============================================================
// CONEXÃO WEBSOCKET
// ============================================================

wss.on("connection", (socket) => {

    socket.roomCode = null;

    socket.playerId = null;


    console.log(
        "=================================================="
    );

    console.log(
        "Novo cliente conectado ao WebSocket."
    );

    console.log(
        "=================================================="
    );


    // --------------------------------------------------------
    // CONFIRMAÇÃO DE CONEXÃO
    // --------------------------------------------------------

    send(socket, {

        type: "connected",

        message:
            "Conectado ao servidor do Still Missing."
    });


    // ========================================================
    // MENSAGEM
    // ========================================================

    socket.on("message", (data) => {

        try {

            const message =
                JSON.parse(
                    data.toString()
                );


            console.log(
                "Mensagem recebida:",
                message.type
            );


            // =================================================
            // CRIAR SALA
            // =================================================

            if (
                message.type ===
                "create_room"
            ) {

                createRoom(
                    socket,
                    message.nickname
                );

                return;
            }


            // =================================================
            // ENTRAR NA SALA
            // =================================================

            if (
                message.type ===
                "join_room"
            ) {

                joinRoom(
                    socket,
                    message.room_code,
                    message.nickname
                );

                return;
            }


            // =================================================
            // INFORMAÇÕES
            // =================================================

            if (
                message.type ===
                "room_info"
            ) {

                sendRoomInfo(socket);

                return;
            }


            // =================================================
            // COMEÇAR PARTIDA
            // =================================================

            if (
                message.type ===
                "start_game"
            ) {

                startGame(
                    socket,
                    message.room_code
                );

                return;
            }


            // =================================================
            // SAIR
            // =================================================

            if (
                message.type ===
                "leave_room"
            ) {

                leaveRoom(socket);

                return;
            }


            // =================================================
            // TIPO DESCONHECIDO
            // =================================================

            send(socket, {

                type: "error",

                message:
                    "Tipo de mensagem desconhecido."
            });


        } catch (error) {

            console.log(
                "Erro ao processar mensagem:",
                error.message
            );


            send(socket, {

                type: "error",

                message:
                    "Mensagem inválida."
            });
        }
    });


    // ========================================================
    // FECHAMENTO DA CONEXÃO
    // ========================================================

    socket.on("close", () => {

        console.log(
            "Cliente desconectou do WebSocket."
        );


        if (socket.roomCode) {

            removePlayerFromRoom(
                socket,
                false
            );
        }
    });


    // ========================================================
    // ERRO
    // ========================================================

    socket.on("error", (error) => {

        console.log(
            "Erro WebSocket:",
            error.message
        );
    });
});


// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "=================================================="
        );

        console.log(
            "STILL MISSING SERVER"
        );

        console.log(
            `Servidor rodando na porta ${PORT}`
        );

        console.log(
            "WebSocket pronto."
        );

        console.log(
            "=================================================="
        );
    }
);
