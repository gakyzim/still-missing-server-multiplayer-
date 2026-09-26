const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

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

const wss = new WebSocket.Server({
    server
});

wss.on("connection", (socket) => {
    console.log("Novo jogador conectado.");

    socket.send(JSON.stringify({
        type: "connected",
        message: "Conectado ao servidor do Still Missing."
    }));

    socket.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            console.log("Recebido:", message);

            socket.send(JSON.stringify({
                type: "echo",
                data: message
            }));

        } catch (error) {
            socket.send(JSON.stringify({
                type: "error",
                message: "Mensagem inválida."
            }));
        }
    });

    socket.on("close", () => {
        console.log("Jogador desconectado.");
    });

    socket.on("error", (error) => {
        console.log("Erro:", error.message);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
