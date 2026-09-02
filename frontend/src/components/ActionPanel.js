import React, { useEffect, useMemo, useState } from "react";

// Genera un array di numeri sequenziali a partire da 1 fino a maxDice
function buildDiceOptions(maxDice) {
  const safeMax = Math.max(1, Number(maxDice) || 1);
  return Array.from({ length: safeMax }, (_, index) => index + 1);
}

// Genera un intervallo di numeri interi consecutivi compresi tra minTroops e maxTroops
function buildTroopOptions(minTroops, maxTroops) {
  const safeMin = Math.max(1, Number(minTroops) || 1);
  const safeMax = Math.max(safeMin, Number(maxTroops) || safeMin);
  return Array.from({ length: safeMax - safeMin + 1 }, (_, index) => safeMin + index);
}

// Tronca una stringa se supera una lunghezza massima
function shortenText(value, max = 22) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Restituisce il testo corrispondente alla fase di gioco corrente
function getPhaseActionTitle(phase) {
  if (phase === "reinforcement") return "Rinforzo";
  if (phase === "attack") return "Attacco";
  if (phase === "postConquestTransfer") return "Conquista";
  return "Controlli turno";
}

// Componente che rappresenta il pannello di controllo principale delle azioni di gioco
function ActionPanel({
  gameState,
  selectedTerritory,
  loading = false,
  error = "",
  onReinforce,
  onAttack,
  onMoveConquestTroops,
  onEndTurn,
  isHost = false,
  onEndGame       
}) {
  const [attackDice, setAttackDice] = useState(1);
  const [conquestTroops, setConquestTroops] = useState(1);

  // Ricava l'oggetto del giocatore di turno
  const currentPlayer = useMemo(() => {
    if (!gameState) return null;
    if (gameState.currentPlayer) return gameState.currentPlayer;
    if (Array.isArray(gameState.players) && Number.isInteger(gameState.currentPlayerIndex)) {
      return gameState.players[gameState.currentPlayerIndex] || null;
    }
    return null;
  }, [gameState]);

  const pendingAttack = gameState?.pendingAttack || null;
  const pendingTroopTransfer = gameState?.pendingTroopTransfer || null;
  const battle = gameState?.battle || null;
  const winner = gameState?.winner || null;
  const phase = gameState?.phase || "setup";
  const selectedOwnerId = selectedTerritory?.ownerId ?? null;  

  // Verifica se il territorio attualmente selezionato appartiene al giocatore corrente
  const selectedIsCurrentPlayerTerritory = 
    Boolean(selectedTerritory) && Boolean(currentPlayer) && selectedOwnerId === currentPlayer.id;

  // Verifica se è possibile attaccare da questo territorio
  const selectedCanAttack =
    Boolean(selectedTerritory) &&
    selectedIsCurrentPlayerTerritory &&
    (selectedTerritory.troops > 1);

  // Recupera l'oggetto del territorio attaccante
  const attackSourceTerritory = useMemo(() => {
    if (!pendingAttack?.attackerTerritoryId) return null;
    if (selectedTerritory?.id === pendingAttack.attackerTerritoryId) return selectedTerritory;
    return gameState?.territories?.[pendingAttack.attackerTerritoryId] || null;
  }, [pendingAttack, selectedTerritory, gameState]);

  // Recupera l'oggetto del territorio di destinazione verso cui spostare le truppe
  const conquestToTerritory = useMemo(() => {
    if (!pendingTroopTransfer?.toTerritoryId) return null;
    return gameState?.territories?.[pendingTroopTransfer.toTerritoryId] || null;
  }, [pendingTroopTransfer, gameState]);

  // Calcola il numero massimo di dadi che l'attaccante può lanciare in battaglia
  const maxAttackDice = useMemo(() => {
    if (pendingAttack?.maxAttackDice) return Math.max(1, pendingAttack.maxAttackDice);
    if (attackSourceTerritory) return Math.max(1, Math.min(3, (attackSourceTerritory.troops ?? 0) - 1));
    if (selectedTerritory) return Math.max(1, Math.min(3, (selectedTerritory.troops ?? 0) - 1));
    return 1;
  }, [pendingAttack, attackSourceTerritory, selectedTerritory]);

  // Determina il valore iniziale da preselezionare nel menu dei dadi di attacco
  const defaultAttackDice = useMemo(() => {
    if (pendingAttack && Number.isInteger(pendingAttack.attackDice) && pendingAttack.attackDice > 0) {
      return Math.min(pendingAttack.attackDice, maxAttackDice);
    }
    return maxAttackDice;
  }, [pendingAttack, maxAttackDice]);

  // Array del numero dei dadi per il menu a tendina
  const attackOptions = useMemo(() => buildDiceOptions(maxAttackDice), [maxAttackDice]);

  const conquestMinTroops = Math.max(1, Number(pendingTroopTransfer?.minTroops) || 1);
  const conquestMaxTroops = Math.max(conquestMinTroops, Number(pendingTroopTransfer?.maxTroops) || conquestMinTroops);

  // Array di tutte le opzioni possibili di truppe da trasferire nel territorio appena conquistato
  const conquestOptions = useMemo(
    () => buildTroopOptions(conquestMinTroops, conquestMaxTroops),
    [conquestMinTroops, conquestMaxTroops]
  );

  // Sincronizza e reimposta i dadi di attacco al valore predefinito
  useEffect(() => {
    if (phase !== "attack") return;
    setAttackDice(defaultAttackDice);
  }, [phase, defaultAttackDice, pendingAttack?.attackerTerritoryId, pendingAttack?.defenderTerritoryId]);

  // Se il massimo dei dadi consentito si è ridotto, abbassa automaticamente la selezione al nuovo limite
  useEffect(() => {
    setAttackDice((prev) => {
      if (prev > maxAttackDice) return maxAttackDice;
      if (prev < 1) return 1;
      return prev;
    });
  }, [maxAttackDice]);

  // Inizializza il numero di truppe da spostare al minimo 
  useEffect(() => {
    if (phase !== "postConquestTransfer") return;
    setConquestTroops(conquestMinTroops);
  }, [phase, conquestMinTroops, pendingTroopTransfer?.fromTerritoryId, pendingTroopTransfer?.toTerritoryId]);

  const troopsToPlace = Number(currentPlayer?.troopsToPlace ?? 0);

  // Controlla se il pulsante di rinforzo deve essere abilitato
  const canReinforce =
    Boolean(gameState) &&
    !winner &&
    phase === "reinforcement" &&
    Boolean(selectedTerritory) &&
    Boolean(currentPlayer) &&
    selectedIsCurrentPlayerTerritory &&
    troopsToPlace > 0;

  // Controlla se il giocatore può effettivamente sferrare l'attacco
  const canAttack =
    Boolean(gameState) &&
    !winner &&
    phase === "attack" &&
    Boolean(pendingAttack?.attackerTerritoryId) &&
    Boolean(pendingAttack?.defenderTerritoryId);

  // Controlla se è possibile confermare lo spostamento delle truppe
  const canMoveConquestTroops =
    Boolean(gameState) &&
    !winner &&
    phase === "postConquestTransfer" &&
    Boolean(pendingTroopTransfer) &&
    Boolean(currentPlayer);

  // Fase dove l'attaccante è già stato scelto e il giocatore deve selezionare il territorio bersaglio
  const isChoosingAttackTarget =
    Boolean(gameState) &&
    !winner &&
    phase === "attack" &&
    (Boolean(pendingAttack?.attackerTerritoryId) || selectedCanAttack) &&
    !pendingAttack?.defenderTerritoryId;

  // Controlla se il giocatore può terminare il proprio turno
  const canEndTurn =
    Boolean(gameState) &&
    !winner &&
    phase !== "gameOver" &&
    phase !== "postConquestTransfer";

  // Genera un messaggio di stato dinamico per l'utente durante la fase di rinforzo
  const reinforceStatusMessage = useMemo(() => {
    if (!gameState) return "Nessuna partita caricata.";
    if (winner) return "La partita è terminata.";
    if (phase !== "reinforcement") return "Il rinforzo non è attivo in questa fase.";
    if (!currentPlayer) return "Giocatore corrente non disponibile.";
    if (!selectedTerritory) return "Seleziona un tuo territorio sulla mappa.";
    if (!selectedIsCurrentPlayerTerritory) return "Puoi rinforzare solo un territorio del giocatore corrente.";
    if (troopsToPlace <= 0) return "Non hai rinforzi disponibili.";
    return `Pronto al rinforzo su ${selectedTerritory.name}.`;
  }, [gameState, winner, phase, currentPlayer, selectedTerritory, selectedIsCurrentPlayerTerritory, troopsToPlace]);

  // Genera un messaggio di stato dinamico per l'utente durante la fase di attacco
  const attackStatusMessage = useMemo(() => {
    if (winner) return "La partita è terminata.";
    if (phase !== "attack") return "L'attacco non è attivo in questa fase.";
    if (isChoosingAttackTarget) return "Attaccante scelto. Seleziona un bersaglio confinante.";
    if (!pendingAttack?.attackerTerritoryId && !pendingAttack?.defenderTerritoryId) return "Seleziona attaccante e bersaglio.";
    if (!pendingAttack?.defenderTerritoryId) return "Seleziona il territorio bersaglio.";
    return "Configura i dadi e avvia l'attacco.";
  }, [winner, phase, isChoosingAttackTarget, pendingAttack]);

  // Genera un messaggio di stato dinamico per l'utente durante la fase di spostamento truppe
  const conquestStatusMessage = useMemo(() => {
    if (winner) return "La partita è terminata.";
    if (phase !== "postConquestTransfer" || !pendingTroopTransfer) return "Nessuno spostamento in corso.";
    return `Hai conquistato ${conquestToTerritory?.name || "il territorio"}: scegli quante truppe spostare.`;
  }, [winner, phase, pendingTroopTransfer, conquestToTerritory]);

  // Gestisce l'invio del form di attacco
  const handleAttackSubmit = (event) => {
    event.preventDefault();
    if (!pendingAttack?.attackerTerritoryId || !pendingAttack?.defenderTerritoryId) return;
    onAttack?.({
      attackerTerritoryId: pendingAttack.attackerTerritoryId,
      defenderTerritoryId: pendingAttack.defenderTerritoryId,
      attackDice: Number(attackDice)
    });
  };

  // Gestisce l'invio del form di spostamento truppe
  const handleConquestTransferSubmit = (event) => {
    event.preventDefault();
    if (!pendingTroopTransfer) return;
    onMoveConquestTroops?.(Number(conquestTroops));
  };

  const targetName = gameState?.territories?.[pendingAttack?.defenderTerritoryId]?.name;
  const attackerName = gameState?.territories?.[pendingAttack?.attackerTerritoryId]?.name;

  // Controlla se lo stato della partita esiste
  if (!gameState) {
    return (
      <div className="risk-action-shell">
        <p className="risk-panel-card__text risk-panel-card__text--compact">Avvia una partita per sbloccare le azioni.</p>
      </div>
    );
  }

  // Rendering grafico
  return (
    <div className="risk-action-shell">
      {error ? <div className="risk-inline-alert risk-inline-alert--danger" role="alert">{error}</div> : null}
      {winner ? <div className="risk-inline-alert risk-inline-alert--success" role="alert">Vincitore: {winner.username || winner}</div> : null}

      <div className="risk-action-header">
        <div>
          <p className="risk-panel-card__eyebrow">Azione del turno</p>
          <h3 className="risk-panel-card__title">{getPhaseActionTitle(phase)}</h3>
        </div>
      </div>

      {/* Se in fase di rinforzo, mostra il pannello dei rinforzi */}
      {phase === "reinforcement" ? (
        <>
          <p className="risk-panel-card__text risk-panel-card__text--compact">{reinforceStatusMessage}</p>
          <div className="risk-action-summary">
            <div className="risk-action-summary__item">
              <span>Giocatore </span><strong>{currentPlayer?.username || "N/D"}</strong>
            </div>
            <div className="risk-action-summary__item">
              <span>Rinforzi </span><strong>{troopsToPlace}</strong>
            </div>
          </div>
          <div className="risk-action-footer">
            <button type="button" className="risk-btn risk-btn--primary risk-btn--block" onClick={onReinforce} disabled={!canReinforce || loading}>
              {loading ? "Operazione..." : "Rinforza territorio"}
            </button>
          </div>
        </>
      ) : null}

      {/* Se in fase di attacco, mostra il pannello di attacco */}
      {phase === "attack" ? (
        <>
          <p className="risk-panel-card__text risk-panel-card__text--compact">{attackStatusMessage}</p>
          <div className="risk-action-summary">
            <div className="risk-action-summary__item">
              <span>Attaccante</span><strong title={attackerName}>{shortenText(attackerName || "Non scelto", 22)}</strong>
            </div>
            <div className="risk-action-summary__item">
              <span>Bersaglio</span><strong title={targetName}>{shortenText(targetName || "Non scelto", 22)}</strong>
            </div>
          </div>

          <form onSubmit={handleAttackSubmit} className="risk-form-stack mt-2">
            <label className="risk-label text-light mb-1" htmlFor="attack-dice-select">Dadi attacco</label>
            <select
              id="attack-dice-select"
              className="risk-select form-select bg-dark text-light border-secondary mb-3"
              value={attackDice}
              onChange={(e) => setAttackDice(Number(e.target.value))}
              disabled={!canAttack || loading}
            >
              {attackOptions.map((value) => (
                <option key={value} value={value}>{value} {value === 1 ? "dado" : "dadi"}</option>
              ))}
            </select>
            <div className="risk-action-footer">
              <button type="submit" className="risk-btn risk-btn--danger risk-btn--block" disabled={!canAttack || loading}>
                {loading ? "Attacco in corso..." : "Avvia attacco"}
              </button>
            </div>
          </form>
        </>
      ) : null}

      {/* Se in fase di spostamento truppe, mostra il pannello di spostamento truppe */}
      {phase === "postConquestTransfer" ? (
        <>
          <p className="risk-panel-card__text risk-panel-card__text--compact">{conquestStatusMessage}</p>
          <form onSubmit={handleConquestTransferSubmit} className="risk-form-stack mt-2">
            <label className="risk-label text-light mb-1" htmlFor="conquest-troops-select">Truppe da spostare</label>
            <select
              id="conquest-troops-select"
              className="risk-select form-select bg-dark text-light border-secondary mb-3"
              value={conquestTroops}
              onChange={(e) => setConquestTroops(Number(e.target.value))}
              disabled={!canMoveConquestTroops || loading}
            >
              {conquestOptions.map((value) => (
                <option key={value} value={value}>{value} {value === 1 ? "truppa" : "truppe"}</option>
              ))}
            </select>
            <div className="risk-action-footer">
              <button type="submit" className="risk-btn risk-btn--primary risk-btn--block" disabled={!canMoveConquestTroops || loading}>
                {loading ? "Spostamento..." : "Conferma spostamento"}
              </button>
            </div>
          </form>
        </>
      ) : null}

      {/* Riepilogo dell'ultima battaglia */}
      {battle ? (
        <div className="risk-battle-strip mt-3 mb-2 p-2 bg-dark rounded border border-secondary d-flex justify-content-between text-center" style={{ fontSize: "0.85rem" }}>
          <div><span className="d-block text-muted">Dadi Att.</span><strong className="text-danger">[{battle.attackRolls?.join(", ") || "-"}]</strong></div>
          <div><span className="d-block text-muted">Dadi Dif.</span><strong className="text-info">[{battle.defendRolls?.join(", ") || "-"}]</strong></div>
          <div><span className="d-block text-muted">Persi A</span><strong className="text-danger">{battle.attackerLosses ?? 0}</strong></div>
          <div><span className="d-block text-muted">Persi D</span><strong className="text-info">{battle.defenderLosses ?? 0}</strong></div>
        </div>
      ) : null}

      {/* Gestione dinamica del pulsante in caso di vittoria */}
      {winner ? (
        <div className="risk-action-footer mt-3">
          {isHost ? (
            <button 
              type="button" 
              className="risk-btn risk-btn--success risk-btn--block w-100 btn btn-success fw-bold text-light" 
              onClick={onEndGame} 
              disabled={loading}
            >
              {loading ? "Chiusura..." : "Torna alla Home"}
            </button>
          ) : (
            <p className="text-center text-info small mb-0 mt-2">
              In attesa che l'Host chiuda la partita...
            </p>
          )}
        </div>
      ) : (
        <div className="risk-action-footer mt-3">
          <button 
            type="button" 
            className="risk-btn risk-btn--ghost risk-btn--block w-100 btn btn-outline-secondary text-light" 
            onClick={onEndTurn} 
            disabled={!canEndTurn || loading}
          >
            Termina turno
          </button>
        </div>
      )}
    </div>
  );
}

export default ActionPanel;