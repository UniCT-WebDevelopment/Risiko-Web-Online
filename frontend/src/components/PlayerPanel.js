import { useEffect, useMemo, useState } from "react";

// Componente che mostra il pannello di gioco con l'obiettivo segreto dell'utente e la lista dei giocatori
function PlayerPanel({
  players = [],
  territories = {},
  currentPlayerId = null,
  localUser = null,
  winner = null,
  isGameOver = false,
  victoryMode = "world"
}) {
  const [isObjectiveVisible, setIsObjectiveVisible] = useState(false);

  // Estrae i valori dall'oggetto dei territori trasformandoli in un array
  const territoryList = useMemo(() => Object.values(territories || {}), [territories]);

  // Nasconde automaticamente l'obiettivo segreto non appena la partita finisce
  useEffect(() => {
    if (isGameOver) setIsObjectiveVisible(false);
  }, [isGameOver]);

  // Calcola e restituisce le statistiche di un giocatore
  function getPlayerStats(playerId) {
    const ownedTerritories = territoryList.filter(
      (territory) => String(territory.ownerId) === String(playerId)
    );

    const territoryCount = ownedTerritories.length;
    const totalTroops = ownedTerritories.reduce(
      (sum, territory) => sum + (Number(territory.troops) || 0), 0);

    return {
      territoryCount,
      totalTroops,
      eliminated: territoryCount === 0 && Object.keys(territories).length > 0
    };
  }

  // Verifica se il giocatore corrisponde al vincitore della partita
  function isWinnerPlayer(player) {
    if (!winner || !player) return false;
    if (typeof winner === "string" || typeof winner === "number") {
      return String(winner) === String(player.id) || String(winner) === String(player.username);
    }
    return (
      String(winner?.id) === String(player.id) ||
      String(winner?.username) === String(player.username)
    );
  }

  // Estrae e restituisce il testo dell'obiettivo
  function getObjectiveLabel(objective) {
    if (!objective) return "";
    if (typeof objective === "string") return objective;
    if (typeof objective.label === "string" && objective.label.trim()) return objective.label.trim();
    if (typeof objective.description === "string" && objective.description.trim()) return objective.description.trim();
    return "Obiettivo assegnato.";
  }

  // Identifica l'oggetto del giocatore tramite username
  const localPlayer = useMemo(() => {
    if (localUser) return players.find(p => p.username === localUser.username) || null;
    if (!isGameOver) {
      return players.find(p => p.secretObjective !== null) || null;
    }
    return null;
  }, [players, localUser, isGameOver]);

  // Estrae il testo dell'obiettivo segreto del giocatore
  const localPlayerObjectiveLabel = useMemo(() => {
    return getObjectiveLabel(localPlayer?.secretObjective);
  }, [localPlayer]);

  // Determina se mostrare la card dell'obiettivo segreto
  const shouldShowSecretObjectiveCard =
    victoryMode === "objectives" && !isGameOver && Boolean(localPlayerObjectiveLabel);

  // Abilita la visualizzazione pubblica degli obiettivi di tutti i giocatori se la partita è terminata
  const shouldShowRevealedObjectives = victoryMode === "objectives" && isGameOver;

  const objectivePanelId = "risk-secret-objective-panel";
  const objectiveButtonId = "risk-secret-objective-toggle";

  // Gestisce il caso limite in cui non ci sono giocatori
  if (!players.length) {
    return (
      <div className="risk-player-panel risk-player-panel--horizontal">
        <p className="risk-panel-card__text text-muted">
          Nessun partecipante disponibile al momento.
        </p>
      </div>
    );
  }

  // Esegue il rendering dell'interfaccia utente: obiettivo segreto e l'elenco dei giocatori
  return (
    <div className="risk-player-panel risk-player-panel--horizontal">
      
      {/* Mostra l'obiettivo segreto all'utente */}
      {shouldShowSecretObjectiveCard ? (
        <div className="risk-secret-objective-card mb-3 p-3 border border-warning rounded bg-dark">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <p className="mb-0 text-warning" style={{fontSize: "0.75rem", fontWeight: "bold"}}>IL TUO OBIETTIVO</p>
              <span className="text-light" style={{fontSize: "0.85rem"}}>Missione Segreta</span>
            </div>

            <button
              id={objectiveButtonId}
              type="button"
              className={`btn btn-sm ${isObjectiveVisible ? "btn-outline-light" : "btn-warning"}`}
              onClick={() => setIsObjectiveVisible((current) => !current)}
              aria-expanded={isObjectiveVisible}
              aria-controls={objectivePanelId}
            >
              {isObjectiveVisible ? "Nascondi" : "Mostra"}
            </button>
          </div>

          {isObjectiveVisible && (
            <div id={objectivePanelId} className="mt-2 pt-2 border-top border-secondary">
              <p className="mb-0 text-white fw-bold" style={{fontSize: "0.85rem"}}>
                {localPlayerObjectiveLabel}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Renderizza una card per ogni partecipante */}
      <div className="risk-player-list risk-player-list--horizontal">
        {players.map((player) => {
          const stats = getPlayerStats(player.id);
          const isCurrent = String(player.id) === String(currentPlayerId);
          const isWinner = isWinnerPlayer(player);
          
          const isMe = localUser && player.username === localUser.username;
          
          const revealedObjectiveLabel = getObjectiveLabel(player?.secretObjective);
          const hasRevealedObjective = Boolean(revealedObjectiveLabel);

          return (
            <article
              key={player.id}
              className={[
                "risk-player-card",
                isCurrent ? "is-current border-primary" : "",
                isWinner ? "is-winner border-success" : "",
                stats.eliminated ? "is-eliminated" : ""
              ].filter(Boolean).join(" ")}
            >
              {/* Colore + Nome + Badge */}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="risk-player-card__color-indicator"
                    style={{ backgroundColor: player.color || "#64748b" }}
                    title={`Colore: ${player.color}`}
                    aria-hidden="true"
                  />
                  <h4 className="risk-player-card__name text-white m-0 text-truncate" style={{ maxWidth: '100px' }}>
                    {player.username}
                  </h4>
                  {isMe && <span className="badge bg-secondary text-xs">Tu</span>}
                </div>

                <div className="d-flex flex-column gap-1 align-items-end">
                  {isCurrent && !isGameOver ? (
                    <span className="risk-mini-chip bg-primary text-white">Turno</span>
                  ) : null}
                  {isWinner ? (
                    <span className="risk-mini-chip bg-success text-white">Vincitore</span>
                  ) : null}
                  {stats.eliminated ? (
                    <span className="risk-mini-chip bg-danger text-white">Eliminato</span>
                  ) : null}
                </div>
              </div>

              {/* Statistiche (Territori e Truppe)*/}
              <div className="risk-stat-grid risk-stat-grid--players">
                <div className="risk-stat-box p-2 text-center">
                  <span className="risk-stat-box__label">Territori</span>
                  <strong>{stats.territoryCount}</strong>
                </div>
                <div className="risk-stat-box p-2 text-center">
                  <span className="risk-stat-box__label">Truppe</span>
                  <strong>{stats.totalTroops}</strong>
                </div>
              </div>
              
              {/* Mostra pubblicamente nella card del giocatore il testo del suo obiettivo solo a fine partita */}
              {shouldShowRevealedObjectives && hasRevealedObjective ? (
                <div className="mt-2 pt-2 border-top border-secondary text-center">
                  <span className="text-warning d-block mb-1" style={{fontSize: "0.65rem", fontWeight: "bold"}}>Obiettivo Rivelato</span>
                  <p className="mb-0 text-light" style={{fontSize: "0.75rem"}}>
                    {revealedObjectiveLabel}
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerPanel;