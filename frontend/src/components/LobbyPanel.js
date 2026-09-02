import React, { useState, useEffect } from "react";

// Componente per visualizzare la lobby pre partita
const LobbyPanel = ({ socket, currentUser, onLobbyJoined, onLobbyLeft }) => {
  const [lobby, setLobby] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [victoryMode, setVictoryMode] = useState("world"); 

  // Resta in ascolto via socket degli aggiornamenti o della chiusura della lobby  
  useEffect(() => {
    const handleLobbyUpdated = (updatedLobby) => setLobby(updatedLobby);
    const handleLobbyDestroyed = () => {
      setLobby(null);
      setJoinCode("");
      if (onLobbyLeft) onLobbyLeft();
    };

    socket.on("lobby_updated", handleLobbyUpdated);
    socket.on("lobby_destroyed", handleLobbyDestroyed);

    return () => {
      socket.off("lobby_updated", handleLobbyUpdated);
      socket.off("lobby_destroyed", handleLobbyDestroyed);
    };
  }, [socket, onLobbyLeft]);
  
  // Crea una nuova lobby
  const handleCreateLobby = () => {
    setError(null);
    setLoading(true);
    socket.emit("create_lobby", (response) => {
      setLoading(false);
      if (response.success) {
        setLobby(response.lobby);
        onLobbyJoined(response.lobby.code, response.lobby.isHost);
      } else {
        setError(response.error);
      }
    });
  };

  // Entra in una lobby esistente
  const handleJoinLobby = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setError(null);
    setLoading(true);

    socket.emit("join_lobby", { code: joinCode.trim().toUpperCase() }, (response) => {
      setLoading(false);
      if (response.success) {
        setLobby(response.lobby);
        onLobbyJoined(response.lobby.code, response.lobby.isHost);
      } else {
        setError(response.error);
      }
    });
  };

  // Avvia la partita
  const handleStartGame = () => {
    setError(null);
    socket.emit("start_game", { lobbyId: lobby.id, code: lobby.code, victoryMode }, (response) => {
      if (!response.success) setError(response.error);
    });
  };

  // Gestisce l'uscita dell'utente dalla lobby
  const handleLeaveLobbyState = () => {
    if (!lobby) {
      setJoinCode("");
      setError(null);
      if (onLobbyLeft) onLobbyLeft();
      return;
    }
    setLoading(true);
    socket.emit("leave_lobby", { lobbyId: lobby.id, code: lobby.code }, () => {
      setLoading(false);
      setLobby(null);
      setJoinCode("");
      setError(null);
      if (onLobbyLeft) onLobbyLeft();
    });
  };

  // Rendering interfaccia grafica se l'utente è attualmente dentro una lobby
  if (lobby) {
    const canStart = lobby.players.length >= 2;

    return (
      <div className="card bg-secondary text-light p-4 mx-auto shadow" style={{ maxWidth: "450px" }}>
        <h3 className="text-center text-warning mb-1">Lobby: {lobby.code}</h3>
        <p className="text-center small text-light opacity-75 mb-4">Condividi questo codice per far unire gli altri</p>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <h6 className="border-bottom border-dark pb-2">Giocatori ({lobby.players.length}/6)</h6>
        <ul className="list-group mb-4">
          {lobby.players.map((p, index) => (
            <li key={index} className="list-group-item bg-dark text-light d-flex justify-content-between align-items-center border-secondary">
              <span>{p.username}</span>
              <div>
                {p.username === currentUser.username && <span className="badge bg-info text-dark">Tu</span>}
              </div>
            </li>
          ))}
        </ul>
        
        {/* Se l'utente è l'Host mostra un menu per scegliere la modalità di gioco */}
        {lobby.isHost ? (
          <>
            <div className="mb-3">
              <label className="form-label small text-light opacity-75">Modalità di Vittoria</label>
              <select 
                className="form-select bg-dark text-light border-secondary"
                value={victoryMode}
                onChange={(e) => setVictoryMode(e.target.value)}
                disabled={!canStart}
              >
                <option value="world">Dominio Globale (Classica)</option>
                <option value="objectives">Obiettivi Segreti</option>
              </select>
            </div>
            <button
              className="btn btn-success w-100 fw-bold mb-2"
              onClick={handleStartGame}
              disabled={!canStart}
            >
              {canStart ? "AVVIA PARTITA" : "Attesa giocatori (minimo 2)..."}
            </button>
          </>
        ) : (
          <div className="alert alert-info text-center py-2 mb-2">
            In attesa che l'Host avvii la partita...
          </div>
        )}

        <button
          className="btn btn-outline-light w-100 fw-bold mt-2"
          onClick={handleLeaveLobbyState}
          disabled={loading}
        >
          {loading ? "Uscita..." : "Torna alla Home"}
        </button>
      </div>
    );
  }

  // Rendering interfaccia grafica
  return (
    <div className="card bg-secondary text-light p-4 mx-auto shadow" style={{ maxWidth: "400px" }}>
      <h4 className="text-center mb-2">Benvenuto, {currentUser.username}!</h4>
      
      {/* Statistiche giocatore */}
      <div className="d-flex justify-content-around bg-dark p-3 rounded mb-4 text-center border border-secondary">
        <div>
          <small className="text-muted d-block text-uppercase" style={{ fontSize: "0.75rem" }}>Partite Giocate</small>
          <span className="fs-5 text-light fw-bold">{currentUser.games_played || 0}</span>
        </div>
        <div>
          <small className="text-muted d-block text-uppercase" style={{ fontSize: "0.75rem" }}>Vittorie</small>
          <span className="fs-5 text-warning fw-bold">{currentUser.games_won || 0}</span>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {/* Pulsante per creare una lobby */}
      <button
        className="btn btn-warning w-100 fw-bold mb-4"
        onClick={handleCreateLobby}
        disabled={loading}
      >
        {loading ? "Creazione..." : "Crea Nuova Lobby"}
      </button>

      <div className="text-center text-uppercase small text-light opacity-75 mb-3">oppure</div>

      {/* Form per entrare in una lobby */}
      <form onSubmit={handleJoinLobby}>
        <div className="mb-3">
          <input
            type="text"
            className="form-control text-center text-uppercase fw-bold"
            placeholder="Codice Lobby (es. A1B2C3)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            disabled={loading}
          />
        </div>
        <button className="btn btn-primary w-100 fw-bold" type="submit" disabled={loading}>
          Entra in Lobby
        </button>
      </form>
    </div>
  );
};

export default LobbyPanel;