import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/app.css";
import "./styles/board.css";

import { getMe } from "./services/api";
import AuthPanel from "./components/AuthPanel";
import LobbyPanel from "./components/LobbyPanel";
import GameBoard from "./components/GameBoard";
import Sidebar from "./components/Sidebar";
import PlayerPanel from "./components/PlayerPanel";
import RulesPanel from "./components/RulesPanel";
import BattleArena from "./components/BattleArena";

const SERVER_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/+$/, "") : "";
const socket = io(SERVER_URL, { autoConnect: false });

// Componente principale
function App() {
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem("risiko_session") || null);
  const [currentLobbyCode, setCurrentLobbyCode] = useState(() => sessionStorage.getItem("risiko_lobby") || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const [, setInternalGameState] = useState(null);
  const [displayedGameState, setDisplayedGameState] = useState(null);
  const [arenaData, setArenaData] = useState(null);

  const internalRef = useRef(null);
  const displayedRef = useRef(null);
  const arenaRef = useRef(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Gestisce la disconnessione
  const handleLogout = useCallback(() => {
    if (socket.connected) socket.emit("explicit_disconnect");
    socket.disconnect(); 

    setSessionId(null);
    setCurrentUser(null);
    setInternalGameState(null);
    setDisplayedGameState(null);
    internalRef.current = null;
    displayedRef.current = null;
    setArenaData(null);
    arenaRef.current = null;
    setCurrentLobbyCode(null);
    setIsHost(false);
    setError("");
    
    sessionStorage.removeItem("risiko_session");
    sessionStorage.removeItem("risiko_lobby");
  }, []);

  // Gestisce il salvataggio della sessione dopo il login
  const handleLoginSuccess = (newSessionId) => {
    sessionStorage.setItem("risiko_session", newSessionId);
    setSessionId(newSessionId);
  };

  // Gestisce l'autenticazione iniziale e l'avvio della connessione
  useEffect(() => {
    if (sessionId) {
      getMe().then(user => {
        setCurrentUser(user);
        socket.auth = { sessionId };
        socket.connect();
      }).catch((err) => {
        console.error("Sessione non valida", err);
        handleLogout();
      });
    }
  }, [sessionId, handleLogout]);

  // Si occupa di sincronizzare il gioco in tempo reale
  useEffect(() => {
    if (!sessionId) return;

    // Gestisce la riconnessione automatica a una partita/lobby
    const handleConnect = () => {
      if (currentLobbyCode) {
        socket.emit("reconnect_game", { code: currentLobbyCode }, (reconnectRes) => {
          if (reconnectRes?.success && reconnectRes.state === "playing" && reconnectRes.gameState) {
            // Se in gioco
            setInternalGameState(reconnectRes.gameState);
            internalRef.current = reconnectRes.gameState;
            setDisplayedGameState(reconnectRes.gameState);
            displayedRef.current = reconnectRes.gameState;
          } else if (!reconnectRes?.success || reconnectRes.state !== "waiting") {
            // Se non in attesa o errore
            setInternalGameState(null);
            setDisplayedGameState(null);
            internalRef.current = null;
            displayedRef.current = null;
            setCurrentLobbyCode(null);
            setIsHost(false);
            sessionStorage.removeItem("risiko_lobby");
          }
        });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("error", (msg) => setError(msg));
    
    socket.on("connect_error", (err) => {
      if (err.message.includes("Session") || err.message.includes("Accesso negato")) {
        handleLogout();
      } else {
        setError("Errore di connessione al server.");
      }
    });

    // Se si verifica un problema di autorizzazione
    socket.on("auth_error", (data) => {
      alert(data.message || "Errore di autenticazione in tempo reale.");
      handleLogout();
    });

    // Avvia la partita
    socket.on("game_started", (initialState) => {
      setInternalGameState(initialState);
      internalRef.current = initialState;
      setDisplayedGameState(initialState);
      displayedRef.current = initialState;
      setError("");
    });

    // Gestisce ogni aggiornamento dello stato di gioco
    socket.on("game_update", (updatedState) => {
      const prevPending = displayedRef.current?.pendingAttack;
      const wasPendingAttackReady = prevPending?.attackerTerritoryId && prevPending?.defenderTerritoryId;
      const isNewBattle = !!updatedState.battle && wasPendingAttackReady && !updatedState.pendingAttack;

      setInternalGameState(updatedState);
      internalRef.current = updatedState;

      // Gestisce l'animazione della battaglia
      if (isNewBattle && displayedRef.current) {
        const attackerId = prevPending.attackerTerritoryId;
        const defenderId = prevPending.defenderTerritoryId;
        const attackerT = displayedRef.current.territories[attackerId];
        const defenderT = displayedRef.current.territories[defenderId];
        const attackerP = displayedRef.current.players.find(p => p.id === attackerT?.ownerId);
        const defenderP = displayedRef.current.players.find(p => p.id === defenderT?.ownerId);

        // Schermata di scontro
        const newArenaData = {
          battle: updatedState.battle,
          attackerName: attackerP?.username || "Attaccante",
          defenderName: defenderP?.username || "Difensore",
          attackerColor: attackerP?.color || "#e74c3c",
          defenderColor: defenderP?.color || "#3498db",
          attackerTerritory: attackerT?.name || "Territorio",
          defenderTerritory: defenderT?.name || "Territorio"
        };
        
        setArenaData(newArenaData);
        arenaRef.current = newArenaData;

        // Tiene aperta l'animazione dei dadi
        setTimeout(() => {
          setArenaData(null);
          arenaRef.current = null;
          setDisplayedGameState(internalRef.current);
          displayedRef.current = internalRef.current;
        }, 3500); 
      } else {
        if (!arenaRef.current) {
          setDisplayedGameState(updatedState);
          displayedRef.current = updatedState;
        }
      }
      setActionLoading(false);
    });

    // Gestisce l'uscita dalla partita
    const resetGameState = (message) => {
      setInternalGameState(null);
      setDisplayedGameState(null);
      internalRef.current = null;
      displayedRef.current = null;
      setCurrentLobbyCode(null);
      setIsHost(false);
      setError("");
      sessionStorage.removeItem("risiko_lobby");

      getMe().then(user => setCurrentUser(user)).catch(err => console.error(err));

      if (message) alert(message);
    };

    // Uscita dalla partita da parte dell'host
    socket.on("game_ended", () => resetGameState("La partita è stata terminata dall'host."));

    // Uscita dalla partita volontaria
    socket.on("left_game_success", () => resetGameState("Hai abbandonato la partita con successo."));

    // Host esce dalla lobby
    socket.on("lobby_destroyed", () => resetGameState("L'Host ha annullato la lobby."));

    // Giocatore esce dalla partita
    socket.on("player_left", (data) => {
      alert(`Attenzione: Il giocatore ${data.username} ha abbandonato la partita!`);
    });

    // Pulizia dopo eliminazione del componente
    return () => {
      socket.off("connect", handleConnect);
      socket.off("error");
      socket.off("connect_error");
      socket.off("auth_error");
      socket.off("game_started");
      socket.off("game_update");
      socket.off("game_ended");
      socket.off("left_game_success");
      socket.off("player_left");
      socket.off("lobby_destroyed");
    };
  }, [sessionId, currentLobbyCode, handleLogout]); 

  // Registra l'ingresso nella lobby
  const handleLobbyJoined = (code, isUserHost) => {
    setCurrentLobbyCode(code);
    setIsHost(isUserHost);
    sessionStorage.setItem("risiko_lobby", code);
  };

  // Gestisce l'uscita dalla lobby
  const handleLobbyLeft = () => {
    setCurrentLobbyCode(null);
    setIsHost(false);
    sessionStorage.removeItem("risiko_lobby");
  };

  // Controller centrale per inviare tutte le mosse di gioco al server
  const emitAction = useCallback((action, payload = {}) => {
    if (actionLoading || !currentLobbyCode) return;
    setActionLoading(true);
    setError("");
    socket.emit("game_action", { action, code: currentLobbyCode, payload }, (res) => {
      if (!res.success) {
        setError(res.error);
        setActionLoading(false);
      }
    });
  }, [actionLoading, currentLobbyCode]);

  const handleSelectTerritory = useCallback((territoryId) => emitAction("select_territory", { territoryId }), [emitAction]);
  const handleReinforce = useCallback(() => emitAction("reinforce"), [emitAction]);
  const handleAttack = useCallback(({ attackDice }) => emitAction("attack", { attackDice }), [emitAction]);
  const handleMoveConquestTroops = useCallback((troops) => emitAction("transfer_troops", { troops }), [emitAction]);
  const handleEndTurn = useCallback(() => emitAction("end_turn"), [emitAction]);

  // Gestisce la richiesta da parte dell'host di terminare forzatamente la partita in corso
  const handleEndGame = useCallback(() => {
    if (isHost && currentLobbyCode) {
      socket.emit("end_game", { code: currentLobbyCode });
    }
  }, [isHost, currentLobbyCode]);

  // Gestisce l'abbandono volontario della partita da parte di un partecipante
  const handleLeaveGame = useCallback(() => {
    if (!isHost && currentLobbyCode) {
      // Blocca ulteriori click mentre il server lavora
      setActionLoading(true);

      socket.emit("leave_game", { code: currentLobbyCode });
    }
  }, [isHost, currentLobbyCode]);

  // Schermata di caricamento dati utente
  if (sessionId && !currentUser) {
    return (
      <div className="vh-100 bg-dark text-light d-flex justify-content-center align-items-center">
        <h3>Accesso in corso...</h3>
      </div>
    );
  }

  // Schermata Login/Registrazione
  if (!sessionId || !currentUser) {
    return <AuthPanel onLoginSuccess={handleLoginSuccess} />;
  }

  // Header superiore
  const renderHeader = () => (
    <header className="bg-dark text-white p-3 d-flex justify-content-between align-items-center border-bottom border-secondary">
      <h3 className="m-0 fw-bold">Risiko Online</h3>
      <div className="d-flex align-items-center gap-3">
        <span>Utente: <strong className="text-warning">{currentUser.username}</strong></span>
        <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );

  // Schermata Lobby pre-partita
  if (!displayedGameState) {
    return (
      <div className="bg-dark text-light min-vh-100 d-flex flex-column">
        {renderHeader()}
        {error && <div className="alert alert-danger m-3">{error}</div>}
        <main className="container my-auto py-4">
          <LobbyPanel 
            socket={socket} 
            currentUser={currentUser} 
            onLobbyJoined={handleLobbyJoined} 
            onLobbyLeft={handleLobbyLeft}
          />
        </main>
      </div>
    );
  }

  const territories = displayedGameState.territories || {};
  const players = displayedGameState.players || [];
  
  // Recupera il giocatore di turno corrente in 3 modi
  const currentPlayerInGame = displayedGameState.currentPlayer 
    || (displayedGameState.absoluteCurrentPlayerId ? players.find(p => p.id === displayedGameState.absoluteCurrentPlayerId) : null)
    || (players.length > 0 && displayedGameState.currentPlayerIndex !== undefined ? players[displayedGameState.currentPlayerIndex] : null);

  const safeGameState = { ...displayedGameState, currentPlayer: currentPlayerInGame };

  const currentPlayerId = currentPlayerInGame?.id || null;
  const selectedTerritoryId = safeGameState.selectedTerritoryId || null;
  const selectedTerritory = selectedTerritoryId ? territories[selectedTerritoryId] : null;
  const pendingAttack = safeGameState.pendingAttack || null;
  const battle = safeGameState.battle || null;
  const phase = safeGameState.phase || "setup";
  const round = safeGameState.round || 1;
  const winner = safeGameState.winner || null;
  const isGameOver = phase === "gameOver" || winner != null;
  const victoryMode = safeGameState.victoryMode || "world";

  // Render dell'interfaccia partita
  return (
    <div className="app-shell min-vh-100 bg-dark text-light d-flex flex-column position-relative">
      
      {/* Mostra l'interfaccia dell'animazione dei dadi */}
      {arenaData && <BattleArena arenaData={arenaData} />}

      {renderHeader()}
      
      <div className="container-fluid app-container py-3 py-lg-4 flex-grow-1">
        <main className="game-layout game-layout--stacked">
          
          <section className="game-layout__top mb-3">
            <div className="app-panel app-panel--players app-panel--players-full bg-secondary rounded shadow-sm">
              <div className="app-panel__header">
                <div>
                  <span className="app-panel__kicker text-light">Roster</span>
                  <h2 className="app-panel__title text-white">Giocatori in campo</h2>
                </div>
              </div>
              <div className="app-panel__body app-panel__body--players">
                <PlayerPanel
                  players={players}
                  territories={territories}
                  currentPlayerId={currentPlayerId}
                  localUser={currentUser}
                  winner={winner}
                  isGameOver={isGameOver}
                  victoryMode={victoryMode}
                />
              </div>
            </div>
          </section>

          <section className="game-layout__bottom">
            <div className="game-layout__boardcol">
              <div className="app-panel app-panel--board bg-secondary rounded shadow-sm position-relative">
                <div className="app-panel__header">
                  <div>
                    <span className="app-panel__kicker text-light">Tabellone</span>
                    <h2 className="app-panel__title text-white">Mappa strategica</h2>
                  </div>
                  <div className="app-panel__header-actions">
                    {actionLoading && (
                      <span className="risk-mini-chip risk-mini-chip--primary">Sincronizzazione in corso...</span>
                    )}
                  </div>
                </div>
                <div className="app-panel__body app-panel__body--board p-2">
                  <GameBoard
                    territories={territories}
                    players={players}
                    selectedTerritoryId={selectedTerritoryId}
                    onSelectTerritory={handleSelectTerritory}
                    disabled={actionLoading || isGameOver}
                    currentPlayerId={currentPlayerId}
                    attackSourceTerritoryId={pendingAttack?.attackerTerritoryId || null}
                    attackTargetTerritoryId={pendingAttack?.defenderTerritoryId || null}
                    phase={phase}
                    pendingAttack={pendingAttack}
                    battle={battle}
                  />
                </div>
              </div>
              {error && (
                <div className="alert alert-danger shadow-sm border-0 alert-dismissible mt-3 mb-0" role="alert">
                  <strong>Attenzione:</strong> {error}
                  <button type="button" className="btn-close" onClick={() => setError("")}></button>
                </div>
              )}
              <RulesPanel />
            </div>

            <aside className="game-layout__sidebarcol">
              <div className="app-sidebar-stack app-sidebar-stack--match">
                <div className="app-panel app-panel--sidebar app-panel--sidebar-main bg-secondary rounded shadow-sm">
                  <div className="app-panel__header">
                    <div>
                      <span className="app-panel__kicker text-light">Controllo partita</span>
                      <h2 className="app-panel__title text-white">Pannello strategico</h2>
                    </div>
                  </div>
                  <div className="app-panel__body app-panel__body--sidebar app-panel__body--sidebar-natural">
                    <Sidebar
                      players={players}
                      currentPlayer={currentPlayerInGame} 
                      localUser={currentUser}
                      phase={phase}
                      round={round}
                      selectedTerritory={selectedTerritory}
                      winner={winner}
                      gameState={safeGameState} 
                      onReinforce={handleReinforce}
                      onAttack={handleAttack}
                      onMoveConquestTroops={handleMoveConquestTroops}
                      onEndTurn={handleEndTurn}
                      loading={actionLoading}
                      isHost={isHost}
                      onEndGame={handleEndGame}
                      onLeaveGame={handleLeaveGame}
                    />
                  </div>
                </div>
              </div>
            </aside>
          </section>

        </main>
      </div>
    </div>
  );
}

export default App;