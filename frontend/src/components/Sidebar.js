import { memo, useCallback, useMemo } from "react";
import ActionPanel from "./ActionPanel";

// Fasi del gioco
const PHASE_LABELS = {
  setup: "Setup",
  reinforcement: "Rinforzo",
  attack: "Attacco",
  fortify: "Spostamento",
  postConquestTransfer: "Conquista",
  gameOver: "Partita conclusa"
};

// Normalizza i nomi dei continenti
function formatContinent(continent) {
  if (!continent) return "N/D";
  return String(continent).replaceAll("_", " ");
}

// Genera un messaggio di guida per l'interfaccia utente
function getStrategicMessage({ phase, round, currentPlayer, selectedTerritory, winner, isMyTurn }) {
  if (winner) {
    return "La partita è terminata. Consulta il vincitore.";
  }
  if (!currentPlayer) {
    return "Nessun turno disponibile.";
  }
  
  if (!isMyTurn) {
    return `In attesa di ${currentPlayer.username}.`;
  }

  if (Number(round) === 1 && phase === "reinforcement") {
    return "Fase iniziale: seleziona un tuo territorio e distribuisci i rinforzi di partenza.";
  }
  if (Number(round) === 1 && phase === "attack") {
    return "Primo round: dopo la distribuzione iniziale puoi già valutare i primi attacchi.";
  }
  if (phase === "reinforcement") {
    if (!selectedTerritory) return "Seleziona un tuo territorio sulla mappa e piazza i rinforzi disponibili.";
    if (selectedTerritory.ownerId !== currentPlayer.id) return "Puoi rinforzare solo un tuo territorio.";
    return `Territorio selezionato: ${selectedTerritory.name}.`;
  }
  if (phase === "attack") {
    return "Scegli un territorio attaccante e poi un bersaglio confinante.";
  }
  if (phase === "postConquestTransfer") {
    return "Hai conquistato un territorio: scegli quante truppe spostare prima di continuare.";
  }
  if (phase === "setup") {
    return "Configura la partita e completa il posizionamento iniziale.";
  }
  return "Controlla lo stato della partita e scegli la prossima azione.";
}

// Identifica e restituisce la lista di tutti i continenti interamente controllati dal giocatore corrente
function getControlledContinents(currentPlayer, territories, continents) {
  if (!currentPlayer || !territories || !continents) return [];

  return Object.entries(continents)
    // Ritorna i continenti che appartengono al giocatore corrente
    .filter(([, continent]) => {
      const continentTerritories = continent?.territories || [];
      if (!Array.isArray(continentTerritories) || continentTerritories.length === 0) return false;
      return continentTerritories.every((territoryId) => territories[territoryId]?.ownerId === currentPlayer.id);
    })
    // Normalizza e struttura l'oggetto continente per l'uso
    .map(([continentKey, continent]) => ({
      id: continent?.id || continentKey,
      key: continentKey,
      name: continent?.name || formatContinent(continentKey),
      bonus: Number(continent?.bonus || 0),
      territories: Array.isArray(continent?.territories) ? continent.territories : []
    }));
}

// Componente pannello di controllo laterale della partita
function Sidebar({
  players = [],
  currentPlayer = null,
  localUser = null,
  phase = "setup",
  round = 1,
  selectedTerritory = null,
  winner = null,
  gameState = null,
  onReinforce,
  onAttack,
  onMoveConquestTroops,
  onEndTurn,
  loading = false,
  isHost = false, 
  onEndGame,
  onLeaveGame
}) {
  // Trasforma l'array di giocatori in un dizionario
  const playersById = useMemo(() => {
    return players.reduce((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});
  }, [players]);

  // Determina se il turno di gioco corrente appartiene all'utente che sta visualizzando l'applicazione
  const isMyTurn = useMemo(() => {
    return currentPlayer && localUser && currentPlayer.username === localUser.username;
  }, [currentPlayer, localUser]);

  // Calcola la stringa di testo della guida da mostrare all'utente
  const strategicMessage = useMemo(() => {
    return getStrategicMessage({ phase, round, currentPlayer, selectedTerritory, winner, isMyTurn });
  }, [phase, round, currentPlayer, selectedTerritory, winner, isMyTurn]);

  // Estrae l'oggetto territories dallo stato di gioco
  const territories = useMemo(() => {
    return gameState?.territories && typeof gameState.territories === "object" ? gameState.territories : {};
  }, [gameState?.territories]);

  // Estrae l'oggetto continents dallo stato di gioco
  const continents = useMemo(() => {
    return gameState?.continents && typeof gameState.continents === "object" ? gameState.continents : {};
  }, [gameState?.continents]);

  // Calcola la lista dei continenti interamente conquistati dal giocatore
  const controlledContinents = useMemo(() => {
    return getControlledContinents(currentPlayer, territories, continents);
  }, [currentPlayer, territories, continents]);

  // Calcola la somma delle armate bonus da tutti i continenti interamente conquistati dal giocatore
  const continentBonus = useMemo(() => {
    return controlledContinents.reduce((total, continent) => total + Number(continent?.bonus || 0), 0);
  }, [controlledContinents]);

  // Recupera lo username del proprietario di un territorio
  const getOwnerNameById = useCallback((ownerId) => {
      return playersById[ownerId]?.username || "Nessuno";
  }, [playersById]);

  // Rappresenta il layout visivo della barra laterale
  return (
    <aside className="risk-sidepanel">
      
      {/* Sezione host / non-host: nascosta se c'è un vincitore */}
      {!winner && (
        isHost ? (
          <section className="risk-panel-card risk-panel-card--dense mb-3 bg-danger bg-opacity-25 border border-danger">
             <div className="risk-panel-card__header risk-panel-card__header--tight d-flex justify-content-between align-items-center">
               <div>
                 <h3 className="risk-panel-card__title m-0 text-white" style={{ fontSize: "1.1rem" }}>Opzioni Host</h3>
               </div>
               <button 
                  className="btn btn-sm btn-danger fw-bold" 
                  onClick={() => {
                    if(window.confirm("Sei sicuro di voler terminare la partita per tutti?")) {
                      onEndGame();
                    }
                  }}
                >
                 Termina Partita
               </button>
             </div>
          </section>
        ) : (
          <section className="risk-panel-card risk-panel-card--dense mb-3 bg-danger bg-opacity-25 border border-danger">
             <div className="risk-panel-card__header risk-panel-card__header--tight d-flex justify-content-between align-items-center">
               <div>
                 <h3 className="risk-panel-card__title m-0 text-white" style={{ fontSize: "1rem" }}>Opzioni Giocatore</h3>
               </div>
               <button 
                  className="btn btn-sm btn-danger fw-bold text-dark" 
                  onClick={() => {
                    if(window.confirm("Vuoi davvero abbandonare? Le tue truppe resteranno ferme sulla mappa.")) {
                      onLeaveGame();
                    }
                  }}
                >
                 Abbandona
               </button>
             </div>
          </section>
        )
      )}

      {/* Centro comandi del turno corrente */}
      <section className="risk-panel-card risk-panel-card--dense risk-panel-card--hero">
        <div className="risk-panel-card__header risk-panel-card__header--tight">
          <div>
            <p className="risk-panel-card__eyebrow">Centro comandi</p>
            <h2 className="risk-panel-card__title">Turno corrente</h2>
          </div>
          <span className="risk-phase-badge" data-phase={phase || "neutral"}>
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>

        {/* Turno di uno specifico giocatore */}
        {currentPlayer ? (
          <>
            <div className="risk-turn-summary">
              <div className="risk-turn-summary__identity">
                <span className="risk-player-card__dot" style={{ backgroundColor: currentPlayer.color }} aria-hidden="true"></span>
                <div className="risk-turn-summary__names">
                  <p className="risk-turn-summary__name">
                    {currentPlayer.username} {isMyTurn && <span className="badge bg-primary ms-2 text-xs">Tu</span>}
                  </p>
                  <p className="risk-turn-summary__meta">Round {round}</p>
                </div>
              </div>
            </div>

            <div className="risk-kpi-row">
              <div className="risk-kpi-box">
                <span className="risk-kpi-box__label">Rinforzi</span>
                <strong>{currentPlayer.troopsToPlace ?? 0}</strong>
              </div>
              <div className="risk-kpi-box">
                <span className="risk-kpi-box__label">Territori</span>
                <strong>{currentPlayer.territoriesCount ?? 0}</strong>
              </div>
              <div className="risk-kpi-box">
                <span className="risk-kpi-box__label">Truppe</span>
                <strong>{currentPlayer.totalTroops ?? 0}</strong>
              </div>
              <div className="risk-kpi-box">
                <span className="risk-kpi-box__label">Bonus</span>
                <strong>+{continentBonus}</strong>
              </div>
            </div>

            <p className={`risk-panel-card__text risk-panel-card__text--compact risk-panel-card__text--lead fw-bold ${!isMyTurn ? "text-warning" : "text-light"}`}>
              {strategicMessage}
            </p>

            {/* Turno dell'utente o se c'è già un vincitore */}
            {(isMyTurn || winner) && (
              <div className="risk-compact-block mt-3 border-top border-secondary pt-3">
                <ActionPanel
                  gameState={gameState}
                  selectedTerritory={selectedTerritory}
                  loading={loading}
                  onReinforce={onReinforce}
                  onAttack={onAttack}
                  onMoveConquestTroops={onMoveConquestTroops}
                  onEndTurn={onEndTurn}
                  isHost={isHost}
                  onEndGame={onEndGame} 
                />
              </div>
            )}
          </>
        ) : (
          <p className="risk-panel-card__text risk-panel-card__text--compact">Nessun turno disponibile.</p>
        )}
      </section>
      
      {/* Costruisce il riquadro dedicato ai dettagli del territorio selezionato */}
      <section className="risk-panel-card risk-panel-card--dense mt-3">
        <div className="risk-panel-card__header risk-panel-card__header--tight">
          <div>
            <p className="risk-panel-card__eyebrow">Selezione</p>
            <h2 className="risk-panel-card__title">Territorio</h2>
          </div>
        </div>

        {/* Applicato se selezionato un territorio */}
        {selectedTerritory ? (
          <>
            <div className="risk-stat-grid risk-stat-grid--compact">
              <div className="risk-stat-box risk-stat-box--wide">
                <span className="risk-stat-box__label">Nome</span>
                <strong>{selectedTerritory.name}</strong>
              </div>
              <div className="risk-stat-box">
                <span className="risk-stat-box__label">Truppe</span>
                <strong>{selectedTerritory.troops ?? 0}</strong>
              </div>
              <div className="risk-stat-box risk-stat-box--wide">
                <span className="risk-stat-box__label">Proprietario</span>
                <strong>{getOwnerNameById(selectedTerritory.ownerId)}</strong>
              </div>
            </div>
            
            <div className="risk-compact-block mt-2">
              <span className="risk-stat-box__label">Confini</span>
              <div className="risk-inline-meta risk-inline-meta--wrap mt-1">
                {selectedTerritory.adjacentTo?.length ? (
                  selectedTerritory.adjacentTo.map((borderId) => (
                    <span key={borderId} className="risk-mini-chip risk-mini-chip--muted">
                      {territories[borderId]?.name || borderId}
                    </span>
                  ))
                ) : (
                  <span className="risk-mini-chip risk-mini-chip--muted">Nessun confine</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="risk-panel-card__text risk-panel-card__text--compact">Nessun territorio selezionato.</p>
        )}
      </section>
    </aside>
  );
}

export default memo(Sidebar);