const crypto = require("crypto");
const { territories, continents } = require("./mapData");
const { createInitialGameState, cloneObjective, createObjectiveDeckForPlayers } = require("./gameState");

const PLAYER_COLORS = [
  "#e74c3c", // Rosso
  "#3498db", // Blu
  "#2ecc71", // Verde
  "#f1c40f", // Giallo
  "#9b59b6", // Viola
  "#e67e22"  // Arancione
];

const INITIAL_TROOPS_PER_PLAYER = 30;
const MAX_INITIAL_ASSIGNMENT_ATTEMPTS = 500;
const SECRET_OBJECTIVES_MODE = "objectives";
const WORLD_DOMINATION_MODE = "world";
const POST_CONQUEST_TRANSFER_PHASE = "postConquestTransfer";

const FALLBACK_OBJECTIVE_24_TERRITORIES = {
  id: "obj_conquer_24_territories",
  type: "conquer_territories",
  label: "Conquista 24 territori a scelta.",
  continentsToConquer: [],
  requiredExtraContinents: 0,
  requiredTerritories: 24,
  minTroopsPerTerritory: 1,
  targetPlayerId: null,
  fallbackObjectiveId: null
};

// Normalizza la modalità di vittoria
function normalizeVictoryMode(gameOptions = {}) {
  return gameOptions?.victoryMode === SECRET_OBJECTIVES_MODE
    ? SECRET_OBJECTIVES_MODE
    : WORLD_DOMINATION_MODE;
}

// Mescola in modo casuale
function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Mescola in modo casuale i dadi
function rollDice(count) {
  return Array.from({ length: count }, () => crypto.randomInt(1, 7)).sort((a, b) => b - a);
}

// Distribuisce casualmente le truppe iniziali di ciascun giocatore sui territori che possiede
function distributeInitialTroopsRandomly(state, troopsPerPlayer = INITIAL_TROOPS_PER_PLAYER) {
  const territoriesByPlayer = {};

  for (const player of state.players) {
    territoriesByPlayer[player.id] = [];
  }

  // Mappa tutti i territori del tabellone assegnandoli al rispettivo proprietario
  for (const territory of Object.values(state.territories)) {
    if (territory.ownerId != null && territoriesByPlayer[territory.ownerId]) {
      territoriesByPlayer[territory.ownerId].push(territory);
    }
  }

  // Assegna le truppe giocatore per giocatore
  for (const player of state.players) {
    const ownedTerritories = territoriesByPlayer[player.id] || [];
    if (ownedTerritories.length === 0) continue;

    if (ownedTerritories.length > troopsPerPlayer) {
      throw new Error(`Il giocatore ${player.username} possiede più territori delle truppe iniziali disponibili.`);
    }

    // Una truppa per ogni territorio posseduto
    for (const territory of ownedTerritories) {
      territory.troops = 1;
    }

    let remainingTroops = troopsPerPlayer - ownedTerritories.length;

    // Distribuzione casuale delle truppe rimanenti
    while (remainingTroops > 0) {
      const randomIndex = crypto.randomInt(0, ownedTerritories.length);
      ownedTerritories[randomIndex].troops += 1;
      remainingTroops -= 1;
    }
  }
}

// Restituisce i continenti completamente controllati da un determinato giocatore
function getControlledContinents(playerId, state) {
  if (!state.continents || typeof state.continents !== "object") return [];

  // Converte l'oggetto continents in un array di coppie [chiave, valore] e le filtra
  return Object.entries(state.continents).filter(([, continentData]) => {
    const continentTerritories = continentData?.territories || [];
    if (!Array.isArray(continentTerritories) || continentTerritories.length === 0) return false;

    for (const territoryId of continentTerritories) {
      if (state.territories[territoryId]?.ownerId !== playerId) {
        return false;
      }
    }

    // Se il ciclo termina senza ritornare false, il giocatore possiede tutti i territori del continente
    return true;
  });
}

// Verifica se esiste almeno un giocatore che controlla almeno un continente
function hasAnyPlayerControlledContinent(state) {
  for (const player of state.players) {
    if (getControlledContinents(player.id, state).length > 0) return true;
  }
  return false;
}

// Assegna casualmente i territori iniziali ai giocatori garantendo che nessun giocatore
// si ritrovi ad avere già un intero continente sotto controllo a inizio partita
function assignInitialTerritoriesWithoutCompleteContinents(players, territoryState) {
  for (let attempt = 1; attempt <= MAX_INITIAL_ASSIGNMENT_ATTEMPTS; attempt += 1) {
    const shuffledTerritories = shuffleArray(territories);

    for (const territory of Object.values(territoryState)) {
      territory.ownerId = null;
      territory.troops = 0;
    }

    // Assegna ogni territorio mescolato a un giocatore a turno usando il modulo
    shuffledTerritories.forEach((territory, index) => {
      const player = players[index % players.length];
      territoryState[territory.id].ownerId = player.id;
      territoryState[territory.id].troops = 0;
    });

    const temporaryState = { players, territories: territoryState, continents };

    if (!hasAnyPlayerControlledContinent(temporaryState)) {
      return;
    }
  }
  throw new Error("Impossibile generare una distribuzione iniziale valida senza continenti completi.");
}

// Calcola il totale delle truppe bonus da assegnare a un giocatore
function calculateContinentBonus(playerId, state) {
  const controlledContinents = getControlledContinents(playerId, state);
  return controlledContinents.reduce((total, [, continentData]) => {
    return total + Number(continentData?.bonus || 0);
  }, 0);
}

// Calcola le statistiche attuali di possesso (territori e truppe) per ciascun giocatore
function computeOwnershipStats(state) {
  const stats = {};

  for (const player of state.players) {
    stats[player.id] = { territoriesCount: 0, totalTroops: 0 };
  }

  for (const territory of Object.values(state.territories)) {
    const ownerId = territory.ownerId;

    if (ownerId == null || !stats[ownerId]) continue;
    stats[ownerId].territoriesCount += 1;
    stats[ownerId].totalTroops += territory.troops ?? 0;
  }

  return { stats };
}

// Aggiorna le statistiche e lo stato di eliminazione di tutti i giocatori
function updatePlayersStats(state) {
  const { stats } = computeOwnershipStats(state);
  state.players = state.players.map((player) => {
    const playerStats = stats[player.id] || { territoriesCount: 0, totalTroops: 0 };
    return {
      ...player,
      troopsToPlace: Number.isInteger(player.troopsToPlace) ? player.troopsToPlace : 0,
      territoriesCount: playerStats.territoriesCount,
      totalTroops: playerStats.totalTroops,
      eliminated: player.hasLeft || playerStats.territoriesCount === 0 
    };
  });
  return stats;
}

// Restituisce l'oggetto del giocatore a cui spetta il turno corrente
function getCurrentPlayer(state) {
  return state.players[state.currentPlayerIndex] || null;
}

// Cerca e restituisce un giocatore tramite l'id
function getPlayerById(state, playerId) {
  return state.players.find(p => p.id === playerId) || null;
}

// Recupera un territorio
function getTerritoryOrThrow(state, territoryId) {
  const territory = state.territories[territoryId];
  if (!territory) throw new Error("Territorio non trovato.");
  return territory;
}

// Verifica se la partita si trova attualmente nel primo round di gioco
function isFirstRound(state) {
  return Number(state.round || 1) === 1;
}

// Trova l'indice del prossimo giocatore ancora in gioco (non eliminato)
function findNextActivePlayerIndex(state, startIndex) {
  const totalPlayers = state.players.length;
  let nextIndex = startIndex;
  for (let i = 0; i < totalPlayers; i += 1) {
    nextIndex = (nextIndex + 1) % totalPlayers;
    if (!state.players[nextIndex].eliminated) return nextIndex;
  }
  return startIndex;
}

// Calcola il totale delle rinforzi spettanti a un giocatore all'inizio del suo turno
function calculateReinforcements(playerId, state, ownershipStats = null) {
  const territoriesCount = ownershipStats?.[playerId]?.territoriesCount ??
    Object.values(state.territories).filter((t) => t.ownerId === playerId).length;
    
  const territoryBonus = Math.max(3, Math.floor(territoriesCount / 3));
  const continentBonus = calculateContinentBonus(playerId, state);
  return territoryBonus + continentBonus;
}

// Gestisce l'assegnazione dei rinforzi a un giocatore all'inizio del suo turno
function assignTurnReinforcements(state, player) {
  if (!player) return;
  const stats = updatePlayersStats(state);
  const currentStatePlayer = getPlayerById(state, player.id);
  if (!currentStatePlayer) return;

  if (isFirstRound(state)) {
    currentStatePlayer.troopsToPlace = 0;
    return;
  }
  currentStatePlayer.troopsToPlace = calculateReinforcements(currentStatePlayer.id, state, stats);
}

// Inizializza e prepara lo stato del gioco per il turno del giocatore corrente
function prepareTurnForCurrentPlayer(state) {
  state.phase = "reinforcement";
  state.selectedTerritoryId = null;
  state.pendingAttack = null;
  state.pendingTroopTransfer = null;
  state.battle = null;

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer) return null;

  assignTurnReinforcements(state, currentPlayer);
  finalizeStateAfterAction(state);

  if (state.winner) return getCurrentPlayer(state);

  const refreshedPlayer = getCurrentPlayer(state);

  if ((refreshedPlayer.troopsToPlace ?? 0) <= 0) {
    state.phase = "attack";
  }
}

// Verifica se un determinato giocatore ha completato il proprio obiettivo
function checkSecretObjectiveCompleted(player, state) {
  const obj = player?.secretObjective;
  if (!obj) return false;

  if (obj.type === "conquer_continents") {
    const controlled = getControlledContinents(player.id, state).map(([k]) => k);
    return obj.continentsToConquer.every(k => controlled.includes(k));
  }
  if (obj.type === "conquer_continents_plus_one") {
    const controlled = getControlledContinents(player.id, state).map(([k]) => k);
    if (!obj.continentsToConquer.every(k => controlled.includes(k))) return false;
    const extra = controlled.filter(k => !obj.continentsToConquer.includes(k)).length;
    return extra >= Number(obj.requiredExtraContinents || 0);
  }
  if (obj.type === "conquer_territories") {
    const owned = Object.values(state.territories).filter(t => t.ownerId === player.id && t.troops >= (obj.minTroopsPerTerritory || 1)).length;
    return owned >= Number(obj.requiredTerritories || 0);
  }
  if (obj.type === "eliminate_player") {
    const target = getPlayerById(state, obj.targetPlayerId);
    return Boolean(target && target.eliminated);
  }
  return false;
}

// Determina se la partita è terminata e proclama il vincitore
function checkWinner(state) {
  updatePlayersStats(state);
  if (state.winner) return state.winner;

  // Modalità obiettivi
  if (state.victoryMode === SECRET_OBJECTIVES_MODE) {
    for (const player of state.players) {
      if (player.eliminated) continue;
      if (checkSecretObjectiveCompleted(player, state)) {
        state.phase = "gameOver";
        state.winner = { ...player };
        return state.winner;
      }
    }
  }

  // Modalità conquista
  const alivePlayers = state.players.filter(p => !p.eliminated);
  if (alivePlayers.length === 1) {
    state.phase = "gameOver";
    state.winner = { ...alivePlayers[0] };
    return state.winner;
  }
  return null;
}

// Sincronizzazione e chiusura che viene eseguito subito dopo qualsiasi azione di gioco
function finalizeStateAfterAction(state) {
  updatePlayersStats(state);
  checkWinner(state);
  if (state.winner) {
    state.phase = "gameOver";
    state.pendingAttack = null;
    state.pendingTroopTransfer = null;
  }
}

// Avvia una nuova partita
function startNewGame(lobbyPlayers, gameOptions = {}) {
  const playersWithColors = lobbyPlayers.map((p, i) => ({
    ...p,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]
  }));

  const victoryMode = normalizeVictoryMode(gameOptions);
  const newState = createInitialGameState(playersWithColors, victoryMode);
  
  assignInitialTerritoriesWithoutCompleteContinents(newState.players, newState.territories);
  distributeInitialTroopsRandomly(newState, INITIAL_TROOPS_PER_PLAYER);
  
  if (victoryMode === SECRET_OBJECTIVES_MODE) {
    assignSecretObjectives(newState);
  }
  
  finalizeStateAfterAction(newState);  
  prepareTurnForCurrentPlayer(newState);
  
  return newState;
}

// Assegna un obiettivo univoco a ciascun giocatore all'inizio della partita
function assignSecretObjectives(state) {
  const deck = shuffleArray(createObjectiveDeckForPlayers(state.players));
  const assigned = new Set();

  // Assegna una carta per ogni giocatore
  state.players = state.players.map(player => {
    let assignedObj = null;
    for (const obj of deck) {
      if (assigned.has(obj.id)) continue;
      
      if (obj.type === "eliminate_player" && String(obj.targetPlayerId) === String(player.id)) continue;
      
      assigned.add(obj.id);
      assignedObj = cloneObjective(obj);
      break;
    }
    if (!assignedObj) assignedObj = cloneObjective(FALLBACK_OBJECTIVE_24_TERRITORIES);
    return { ...player, secretObjective: assignedObj };
  });
}

// Gestisce la conclusione del turno del giocatore
function endTurn(state, playerId) {
  const currentPlayer = getCurrentPlayer(state);
  
  if (!currentPlayer || currentPlayer.id !== playerId) throw new Error("Non è il tuo turno!");
  if (state.phase === "gameOver") throw new Error("La partita è terminata.");
  if (state.phase === POST_CONQUEST_TRANSFER_PHASE) throw new Error("Devi spostare le truppe prima di passare il turno.");

  const previousIndex = state.currentPlayerIndex;
  const nextIndex = findNextActivePlayerIndex(state, state.currentPlayerIndex);
  
  state.currentPlayerIndex = nextIndex;
  
  // Se l'indice del nuovo giocatore ricomincia da capo, incrementa il round
  if (state.players.length > 0 && nextIndex <= previousIndex) {
    state.round = Number(state.round || 1) + 1;
  }

  prepareTurnForCurrentPlayer(state);
  return state;
}

// Gestisce la selezione di un territorio sulla mappa da parte del giocatore
function selectTerritory(state, playerId, territoryId) {
  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) throw new Error("Non è il tuo turno!");

  if (state.phase === POST_CONQUEST_TRANSFER_PHASE) {
    throw new Error("Devi prima completare lo spostamento truppe dopo la conquista.");
  }

  const territory = getTerritoryOrThrow(state, territoryId);
  state.battle = null;

  // Se non è in fase di attacco, seleziona semplicemente il territorio
  if (state.phase !== "attack") {
    state.selectedTerritoryId = territoryId;
    return state;
  }

  // Nessun territorio attaccante ancora selezionato (Primo click)
  if (!state.pendingAttack) {
    if (territory.ownerId !== playerId || territory.troops < 2) {
      throw new Error("Seleziona un tuo territorio con almeno 2 truppe per attaccare.");
    }
    state.selectedTerritoryId = territoryId;
    state.pendingAttack = {
      attackerPlayerId: playerId,
      attackerTerritoryId: territoryId,
      maxAttackDice: Math.min(3, territory.troops - 1)
    };
  } // Un territorio attaccante è già stato selezionato (Secondo click)
    else {    
    // Click di nuovo sullo stesso territorio attaccante -> Deseleziona
    if (territoryId === state.pendingAttack.attackerTerritoryId) {
      state.selectedTerritoryId = null;
      state.pendingAttack = null;
    } 
    // Click su un altro territorio proprio -> Cambia il territorio di partenza
    else if (territory.ownerId === playerId) {
      if (territory.troops >= 2) {
         state.selectedTerritoryId = territoryId;
         state.pendingAttack = {
            attackerPlayerId: playerId,
            attackerTerritoryId: territoryId,
            maxAttackDice: Math.min(3, territory.troops - 1)
         };
      } else {
          throw new Error("Questo territorio non ha truppe sufficienti per attaccare.");
      }
    } 
    // Click su un territorio nemico -> Bersaglio dell'attacco
    else {
      const attackerTerritory = getTerritoryOrThrow(state, state.pendingAttack.attackerTerritoryId);
      
      const isAdjacent = (attackerTerritory.adjacentTo || []).includes(territoryId);
      
      if (!isAdjacent) {
        throw new Error("Puoi attaccare solo i territori confinanti con il tuo attaccante!");
      }
      
      state.pendingAttack.defenderTerritoryId = territoryId;
      state.pendingAttack.defenderPlayerId = territory.ownerId;
    }
  }
  return state;
}

// Gestisce il piazzamento di una singola truppa di rinforzo sul territorio
function reinforceSelectedTerritory(state, playerId) {
  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) throw new Error("Non è il tuo turno!");
  if (state.phase !== "reinforcement") throw new Error("Non sei nella fase di rinforzo.");
  
  const territory = getTerritoryOrThrow(state, state.selectedTerritoryId);
  if (territory.ownerId !== playerId) throw new Error("Puoi rinforzare solo un tuo territorio.");
  if (currentPlayer.troopsToPlace <= 0) throw new Error("Non hai più truppe da piazzare.");

  territory.troops += 1;
  currentPlayer.troopsToPlace -= 1;
  
  if (currentPlayer.troopsToPlace === 0) {
    state.phase = "attack";
  }
  
  finalizeStateAfterAction(state);
  return state;
}

// Gestisce la battaglia tra due territori
function attackTerritory(state, playerId, attackDice) {
  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) throw new Error("Non è il tuo turno!");
  if (state.phase !== "attack") throw new Error("Non sei nella fase di attacco.");
  
  const { attackerTerritoryId, defenderTerritoryId } = state.pendingAttack || {};
  if (!attackerTerritoryId || !defenderTerritoryId) throw new Error("Seleziona attaccante e difensore.");

  const attacker = getTerritoryOrThrow(state, attackerTerritoryId);
  const defender = getTerritoryOrThrow(state, defenderTerritoryId);

  if (attacker.ownerId !== playerId) throw new Error("Il territorio attaccante non è tuo.");
  if (defender.ownerId === playerId) throw new Error("Non puoi attaccarti da solo.");
  if (attacker.troops <= attackDice) throw new Error("Non hai abbastanza truppe per questo attacco.");
  
  if (!(attacker.adjacentTo || []).includes(defender.id)) {
     throw new Error("Mossa non valida: i territori non sono confinanti.");
  }

  const maxDefendDice = Math.min(3, defender.troops);
  const defendDice = maxDefendDice; 

  const attackRolls = rollDice(attackDice);
  const defendRolls = rollDice(defendDice);
  
  let attackerLosses = 0;
  let defenderLosses = 0;
  
  // Confronto dadi a coppie
  for (let i = 0; i < Math.min(attackDice, defendDice); i++) {
    if (attackRolls[i] > defendRolls[i]) defenderLosses++;
    else attackerLosses++;
  }

  attacker.troops -= attackerLosses;
  defender.troops -= defenderLosses;

  let conquered = false;
  if (defender.troops === 0) {
    conquered = true;
    defender.ownerId = playerId;
    
    state.pendingTroopTransfer = {
      fromTerritoryId: attacker.id,
      toTerritoryId: defender.id,
      minTroops: attackDice,
      maxTroops: attacker.troops - 1
    };
    state.phase = POST_CONQUEST_TRANSFER_PHASE;
  }

  // Salva il resoconto della battaglia
  state.battle = { attackRolls, defendRolls, attackerLosses, defenderLosses, conquered };
  state.pendingAttack = null;

  finalizeStateAfterAction(state);
  return state;
}

// Completa il trasferimento truppe dopo la conquista
function transferConquestTroops(state, playerId, troops) {
  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) throw new Error("Non è il tuo turno!");
  if (state.phase !== POST_CONQUEST_TRANSFER_PHASE || !state.pendingTroopTransfer) {
    throw new Error("Non c'è nessuno spostamento da completare.");
  }

  // Estrae i vincoli calcolati durante l'attacco
  const { fromTerritoryId, toTerritoryId, minTroops, maxTroops } = state.pendingTroopTransfer;
  if (troops < minTroops || troops > maxTroops) throw new Error(`Devi spostare tra ${minTroops} e ${maxTroops} truppe.`);

  const fromTerritory = getTerritoryOrThrow(state, fromTerritoryId);
  const toTerritory = getTerritoryOrThrow(state, toTerritoryId);

  fromTerritory.troops -= troops;
  toTerritory.troops += troops;

  state.pendingTroopTransfer = null;
  state.phase = "attack";
  
  finalizeStateAfterAction(state);
  
  return state;
}

module.exports = {
  startNewGame,
  endTurn,
  selectTerritory,
  reinforceSelectedTerritory,
  attackTerritory,
  transferConquestTroops
};