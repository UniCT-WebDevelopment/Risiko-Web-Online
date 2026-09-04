require("dotenv").config(); 

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");
const router = require("./router");
const db = require("./db");
const path = require("path");

const gameController = require("./controllers/gameController");
const { getSanitizedGameStateForClient } = require("./game/gameState");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || ["http://localhost:3000", "http://localhost:3001"];

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: false
}));

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use("/api", router);

// Stato attivo delle partite: codiceLobby -> gameState
const activeGames = new Map();
// Sockets attualmente connessi: userId -> socketInstance
const connectedSockets = new Map(); 
// Timer per la disconnessione: userId -> timerId
const pendingDisconnects = new Map(); 
// Mappatura utente-partita: userId -> codiceLobby
const userToGameMap = new Map();

// Genera un codice alfanumerico univoco di 6 caratteri maiuscoli per la lobby
function generateLobbyCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); 
}

// Riallinea l'indice del giocatore corrente tra lo stato originale ed il sanitized state
// per evitare desincronizzazioni visive del turno sul client
function applySafeTurnSync(originalState, sanitizedState) {
  if (!originalState || !sanitizedState) return;
  const trueCurrentPlayer = originalState.players[originalState.currentPlayerIndex];
  
  if (trueCurrentPlayer && Array.isArray(sanitizedState.players)) {
      const correctedIndex = sanitizedState.players.findIndex(p => p.id === trueCurrentPlayer.id);
      if (correctedIndex !== -1) {
          sanitizedState.currentPlayerIndex = correctedIndex;
          sanitizedState.currentPlayer = sanitizedState.players[correctedIndex];
          sanitizedState.absoluteCurrentPlayerId = trueCurrentPlayer.id;
      }
  }
}

// Invia lo stato aggiornato del gioco a tutti i socket connessi ad una specifica stanza
async function broadcastGameState(code, state, eventName = "game_update") {
  const sockets = await io.in(code).fetchSockets();
  for (const s of sockets) {
    const userId = s.data.userId;
    // Pulisce lo stato rimuovendo le informazioni riservate agli altri utenti es. obiettivi
    const sanitizedState = getSanitizedGameStateForClient(state, userId);
    
    applySafeTurnSync(state, sanitizedState);
    
    s.emit(eventName, sanitizedState);
  }
}

// Notifica tutti gli utenti in una lobby riguardo a modifiche nella lista giocatori o stato host
async function broadcastLobbyUpdate(code, lobbyId, hostId, players) {
  const socketsInRoom = await io.in(code).fetchSockets();
  for (const s of socketsInRoom) {
    const isHost = (s.data.userId === hostId);
    s.emit("lobby_updated", { id: lobbyId, code, isHost, players });
  }
}

// Salva il risultato finale della partita nel database
async function handleGameEndDB(code, winnerObj = null) {
  try {
    const [lobby] = await db.execute("SELECT id FROM lobbies WHERE code = ?", [code]);
    
    if (lobby.length > 0) {
      const lobbyId = lobby[0].id;
      // Incrementa le partite giocate per tutti
      await db.execute(`UPDATE users SET games_played = games_played + 1 WHERE id IN (SELECT user_id FROM lobby_players WHERE lobby_id = ?)`, [lobbyId]);
      
      // Se c'è un vincitore, incrementa le vittorie
      if (winnerObj) {
        const winnerId = typeof winnerObj === 'object' ? winnerObj.id : winnerObj;
        await db.execute(`UPDATE users SET games_won = games_won + 1 WHERE id = ?`, [winnerId]);
      }
      
      await db.execute("UPDATE lobbies SET status = 'finished' WHERE id = ?", [lobbyId]);
    }
  } catch (dbErr) {
    console.error("Errore nell'aggiornamento statistiche DB:", dbErr);
  }
}

// Gestisce l'abbandono o caduta connessione di un utente da lobby in attesa o partite in corso
async function handleUserDrop(userId) {
  // 1. Gestione caduta connessione se l'utente è ancora in una lobby in attesa
  try {
    const [lobbies] = await db.execute(
      "SELECT id, host_id, code FROM lobbies WHERE status = 'waiting' AND id IN (SELECT lobby_id FROM lobby_players WHERE user_id = ?)",
      [userId]
    );
    if (lobbies.length > 0) {
      const lobby = lobbies[0];
      if (lobby.host_id === userId) {
        // Se l'host cade, la lobby viene distrutta per tutti
        await db.execute("UPDATE lobbies SET status = 'finished' WHERE id = ?", [lobby.id]);
        await db.execute("DELETE FROM lobby_players WHERE lobby_id = ?", [lobby.id]);
        io.to(lobby.code).emit("lobby_destroyed");
        const socketsInRoom = await io.in(lobby.code).fetchSockets();
        for (const s of socketsInRoom) s.leave(lobby.code);
      } else {
        // Se cade un partecipante, lo si rimuove e si aggiorna la lista
        await db.execute("DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?", [lobby.id, userId]);
        const [updatedPlayers] = await db.execute(
          "SELECT u.id, u.username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?",
          [lobby.id]
        );
        await broadcastLobbyUpdate(lobby.code, lobby.id, lobby.host_id, updatedPlayers);
      }
    }
  } catch (e) { console.error(e); }

  // 2. Gestione caduta connessione se l'utente è in partita
  const code = userToGameMap.get(userId);
  
  if (code && activeGames.has(code)) {
    let currentState = activeGames.get(code);
    const playerIndex = currentState.players.findIndex(p => p.id === userId);
    
    if (playerIndex !== -1 && !currentState.players[playerIndex].eliminated) {
      const player = currentState.players[playerIndex];
      player.eliminated = true;
      player.hasLeft = true;

      // Passaggio automatico del turno se il giocatore che cade era di turno
      if (currentState.currentPlayerIndex !== undefined && currentState.players[currentState.currentPlayerIndex].id === userId) {
        try {
          currentState.phase = "attack"; 
          currentState.pendingAttack = null;
          currentState.pendingTroopTransfer = null;
          currentState = gameController.processGameAction("end_turn", currentState, userId);
        } catch (e) {
          // Fallback manuale al prossimo giocatore non eliminato se il controller fallisce
          let nextIdx = currentState.currentPlayerIndex;
          const total = currentState.players.length;
          for (let i = 0; i < total; i++) {
            nextIdx = (nextIdx + 1) % total;
            if (!currentState.players[nextIdx].eliminated) break;
          }
          currentState.currentPlayerIndex = nextIdx;
          currentState.phase = "reinforcement";
        }
      }

      const activePlayers = currentState.players.filter(p => !p.eliminated);
      
      if (activePlayers.length === 0) {
        // Se la partita è vuota, elimina dalla ram e chiude sul DB
        activeGames.delete(code);
        db.execute("UPDATE lobbies SET status = 'finished' WHERE code = ?", [code]).catch(console.error);
      } else if (activePlayers.length === 1 && !currentState.winner) {
        // Un solo giocatore rimasto: vince a tavolino
        currentState.winner = activePlayers[0];
        currentState.phase = "gameOver";
        if (!currentState.statsSaved) {
          currentState.statsSaved = true;
          await handleGameEndDB(code, currentState.winner);
        }
        activeGames.set(code, currentState);
        await broadcastGameState(code, currentState, "game_update");
      } else {
        // Il gioco continua normalmente
        activeGames.set(code, currentState);
        io.to(code).emit("player_left", { username: player.username });
        await broadcastGameState(code, currentState, "game_update");
      }
    }
    
    userToGameMap.delete(userId);
  }
}

// Autenticazione SOCKET.IO
io.use(async (socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  if (!sessionId) return next(new Error("Session ID mancante. Accesso negato."));
  
  try {
    // Verifica del token di sessione nel DB
    const [users] = await db.execute("SELECT id, username FROM users WHERE session_id = ?", [sessionId]);
    if (users.length === 0) return next(new Error("Sessione non valida o scaduta."));
    
    // Aggancia i dati al socket
    socket.data.userId = users[0].id;
    socket.data.username = users[0].username;
    next();
  } catch (err) {
    next(new Error("Errore del server durante l'autenticazione socket."));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;

  // Gestione sessione singola e riconnessioni immediate
  if (pendingDisconnects.has(userId)) {
    // Annulla la procedura di disconnessione se l'utente si riconnette entro il timer previsto
    clearTimeout(pendingDisconnects.get(userId));
    pendingDisconnects.delete(userId);
  } 
  else if (connectedSockets.has(userId)) {
    // Impedisce accessi simultanei con lo stesso account su dispositivi diversi
    const existingSocket = connectedSockets.get(userId);
    if (existingSocket.id !== socket.id) {
      socket.emit("auth_error", { message: "Account già in uso su un'altra scheda o dispositivo." });
      socket.disconnect(true);
      return; 
    }
  }
  
  connectedSockets.set(userId, socket);

  // Riconnessione ad una partita o lobby dopo refresh della pagina
  socket.on("reconnect_game", async ({ code }, callback) => {
    try {
      // 1: La partita è già attiva in memoria
      if (activeGames.has(code)) {
        socket.join(code);
        userToGameMap.set(userId, code);
        
        const state = activeGames.get(code);
        const sanitizedState = getSanitizedGameStateForClient(state, userId);
        
        applySafeTurnSync(state, sanitizedState);
        return callback({ success: true, state: "playing", gameState: sanitizedState });
      }

      // 2: Lobby in attesa, quindi partita non iniziata
      const [lobbies] = await db.execute("SELECT status FROM lobbies WHERE code = ?", [code]);
      if (lobbies.length > 0 && lobbies[0].status === 'waiting') {
        socket.join(code);
        return callback({ success: true, state: "waiting" });
      }

      return callback({ success: false, error: "Partita non trovata o terminata." });
    } catch (err) {
      console.error(err);
      return callback({ success: false, error: "Errore di riconnessione." });
    }
  });

  // Disconnessione volontaria e immediata dell'utente
  socket.on("explicit_disconnect", async () => {
    await handleUserDrop(userId);
    connectedSockets.delete(userId);
    if (pendingDisconnects.has(userId)) {
      clearTimeout(pendingDisconnects.get(userId));
      pendingDisconnects.delete(userId);
    }
  });

  // Creazione di una nuova lobby
  socket.on("create_lobby", async (callback) => {
    try {
      const code = generateLobbyCode();
      const [result] = await db.execute(
        "INSERT INTO lobbies (code, host_id, status) VALUES (?, ?, 'waiting')",
        [code, userId]
      );
      const lobbyId = result.insertId;
      await db.execute("INSERT INTO lobby_players (lobby_id, user_id) VALUES (?, ?)", [lobbyId, userId]);

      socket.join(code);
      const [hostData] = await db.execute("SELECT id, username FROM users WHERE id = ?", [userId]);

      const lobbyData = { id: lobbyId, code: code, isHost: true, players: [{ username: hostData[0].username }] };
      callback({ success: true, lobby: lobbyData });
    } catch (err) {
      callback({ success: false, error: "Errore durante la creazione della lobby" });
    }
  });

  // Ingresso in una lobby esistente
  socket.on("join_lobby", async ({ code }, callback) => {
    try {
      const [lobbies] = await db.execute(
        "SELECT id, code, host_id FROM lobbies WHERE code = ? AND status = 'waiting'", [code]
      );
      if (lobbies.length === 0) return callback({ success: false, error: "Codice non valido o partita già iniziata." });

      const lobby = lobbies[0];

      // Recupera la lista attuale dei giocatori nella lobby
      const [players] = await db.execute(
        "SELECT u.id, u.username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?", [lobby.id]
      );

      if (players.length >= 6) return callback({ success: false, error: "La lobby è piena (max 6 giocatori)." });
      
      // Aggiunge il giocatore se non è già nella lobby
      if (!players.find(p => p.id === userId)) {
        await db.execute("INSERT INTO lobby_players (lobby_id, user_id) VALUES (?, ?)", [lobby.id, userId]);
      }

      const [updatedPlayers] = await db.execute(
        "SELECT u.id, u.username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?",
        [lobby.id]
      );

      socket.join(code);

      // Invia la lista aggiornata dei giocatori a tutti nella lobby
      await broadcastLobbyUpdate(code, lobby.id, lobby.host_id, updatedPlayers);
      
      const isHost = (lobby.host_id === userId);
      const lobbyData = { id: lobby.id, code: lobby.code, isHost, players: updatedPlayers };
      callback({ success: true, lobby: lobbyData });
    } catch (err) {
      callback({ success: false, error: "Errore nell'entrare nella lobby" });
    }
  });

  // Gestisce l'uscita di un giocatore da una lobby
  socket.on("leave_lobby", async ({ lobbyId, code }, callback) => {
    try {
      const [lobbies] = await db.execute("SELECT host_id, status FROM lobbies WHERE id = ?", [lobbyId]);
      if (lobbies.length === 0 || lobbies[0].status !== 'waiting') return callback({ success: true });

      // Se è l'host distrugge la lobby
      if (lobbies[0].host_id === userId) {
        await db.execute("UPDATE lobbies SET status = 'finished' WHERE id = ?", [lobbyId]);
        await db.execute("DELETE FROM lobby_players WHERE lobby_id = ?", [lobbyId]);
        
        socket.to(code).emit("lobby_destroyed");
        const socketsInRoom = await io.in(code).fetchSockets();
        for (const s of socketsInRoom) s.leave(code);
      } else {
        // Se è un giocatore normale rimuove solo lui
        await db.execute("DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?", [lobbyId, userId]);
        socket.leave(code);
        const [updatedPlayers] = await db.execute(
          "SELECT u.id, u.username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?",
          [lobbyId]
        );
        await broadcastLobbyUpdate(code, lobbyId, lobbies[0].host_id, updatedPlayers);
      }
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: "Errore durante l'uscita dalla lobby." });
    }
  });

  // Gestisce l'avvio della partita da parte dell'host della lobby
  socket.on("start_game", async ({ lobbyId, code, victoryMode }, callback) => {
      try {
          // Verifica che sia l'host
          const [lobbies] = await db.execute("SELECT host_id FROM lobbies WHERE id = ?", [lobbyId]);
          if (lobbies.length === 0 || lobbies[0].host_id !== userId) return callback({ success: false, error: "Solo l'Host può avviare la partita." });

          const [players] = await db.execute(
            "SELECT u.id, u.username FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?",
            [lobbyId]
          );

          if (players.length < 2) return callback({ success: false, error: "Servono almeno 2 giocatori per iniziare." });
          
          const validMode = victoryMode === "objectives" ? "objectives" : "world";
          
          // Crea la partita
          const initialState = gameController.createGame(players, { victoryMode: validMode });
          await db.execute("UPDATE lobbies SET status = 'playing' WHERE id = ?", [lobbyId]);
          activeGames.set(code, initialState);

          players.forEach(p => userToGameMap.set(p.id, code));

          await broadcastGameState(code, initialState, "game_started");
          callback({ success: true });
      } catch (err) {
          callback({ success: false, error: "Errore nell'avvio della partita: " + err.message });
      }
  });

  // Gestisce le azioni di gioco inviate dai giocatori durante la partita
  socket.on("game_action", async (data, callback) => {
      const { action, code, payload } = data;
      const state = activeGames.get(code);

      if (!state) return callback({ success: false, error: "Partita non trovata o scaduta." });

      try {
          // Elabora l'azione e ottiene il nuovo stato di gioco
          const newState = gameController.processGameAction(action, state, userId, payload);
          activeGames.set(code, newState);
          
          // Se c'è un vincitore e le statistiche non sono ancora salvate
          if (newState.winner && !newState.statsSaved) {
              newState.statsSaved = true; 
              await handleGameEndDB(code, newState.winner);
          }
          await broadcastGameState(code, newState, "game_update");
          callback({ success: true });
      } catch (err) {
          callback({ success: false, error: err.message });
      }
  });

  // Gestisce l'uscita di un giocatore da una partita in corso
  socket.on("leave_game", async ({ code }) => {
    try {
        const userId = socket.data.userId;
        if (!userId) return;

        const state = activeGames.get(code);
        if (!state) return;
        
        socket.leave(code);
        await handleUserDrop(userId);
        socket.emit("left_game_success");
    } catch (err) { 
        console.error("[Socket] Errore nell'abbandono:", err); 
    }
  });

  // Gestisce la terminazione forzata di una partita da parte dell'host o il ritorno alla home
  socket.on("end_game", async ({ code }) => {
    try {
      const [lobbies] = await db.execute("SELECT id, host_id FROM lobbies WHERE code = ?", [code]);
      if (lobbies.length === 0 || lobbies[0].host_id !== userId) return; 
      
      const state = activeGames.get(code);

      // Salva o aggiorna le statistiche
      if (state && !state.statsSaved) {
          state.statsSaved = true;
          await handleGameEndDB(code, state.winner || null);
      } else if (!state) {
          await handleGameEndDB(code, null); 
      }

      // Rimuove tutti i giocatori dalla mappatura e svuota la memoria
      if (state) state.players.forEach(p => userToGameMap.delete(p.id));
      activeGames.delete(code);

      // Notifica tutti i client per resettare il frontend
      io.to(code).emit("game_ended");

      // Espelle i socket dalla stanza
      const socketsInRoom = await io.in(code).fetchSockets();
      for (const s of socketsInRoom) s.leave(code);
    } catch (err) { console.error(err); }
  });

  // Gestisce la disconnessione di un utente
  socket.on("disconnect", () => {
    if (userId) {
      if (connectedSockets.get(userId)?.id === socket.id) {
        connectedSockets.delete(userId);
      }

      // Imposta un timer per gestire l'abbandono
      const timerId = setTimeout(async () => {
        pendingDisconnects.delete(userId);
        await handleUserDrop(userId);
      }, 4000);

      // Salva il timer per poterlo cancellare se l'utente si riconnette prima
      pendingDisconnects.set(userId, timerId);
    }
  });
});

app.use(express.static(path.join(__dirname, "../frontend/build")));

// Se non è un'API, invia l'HTML di React
/*app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});*/

app.use((req, res) => { res.status(404).json({ error: "Rotta non trovata." }); });

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Errore interno del server." });
});

server.listen(PORT, () => {
  console.log(`Server Risiko Online in ascolto sulla porta ${PORT}`);
});