const { territories, continents } = require("./mapData");

// Inizializza lo stato vuoto di tutti i territori
function createEmptyTerritoriesState() {
  const state = {};

  for (const territory of territories) {
    state[territory.id] = {
      id: territory.id,
      name: territory.name,
      continent: territory.continent,
      adjacentTo: territory.adjacentTo || territory.neighbors || [],
      ownerId: null,
      troops: 0
    };
  }

  return state;
}

// Genera la lista degli obiettivi
function createBaseObjectives() {
  return [
    {
      id: "obj_conquer_asia_south_america",
      type: "conquer_continents",
      label: "Conquista Asia e Sud America.",
      continentsToConquer: ["asia", "south_america"],
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_asia_africa",
      type: "conquer_continents",
      label: "Conquista Asia e Africa.",
      continentsToConquer: ["asia", "africa"],
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_north_america_africa",
      type: "conquer_continents",
      label: "Conquista Nord America e Africa.",
      continentsToConquer: ["north_america", "africa"],
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_north_america_oceania",
      type: "conquer_continents",
      label: "Conquista Nord America e Oceania.",
      continentsToConquer: ["north_america", "oceania"], 
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_europe_south_america_third",
      type: "conquer_continents_plus_one",
      label: "Conquista Europa, Sud America e un terzo continente a scelta.",
      continentsToConquer: ["europe", "south_america"],
      requiredExtraContinents: 1,
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_europe_oceania_third",
      type: "conquer_continents_plus_one",
      label: "Conquista Europa, Oceania e un terzo continente a scelta.",
      continentsToConquer: ["europe", "oceania"], 
      requiredExtraContinents: 1,
      targetPlayerId: null,
      fallbackObjectiveId: null
    },
    {
      id: "obj_conquer_24_territories",
      type: "conquer_territories",
      label: "Conquista 24 territori a scelta.",
      requiredTerritories: 24,
      minTroopsPerTerritory: 1,
      targetPlayerId: null,
      fallbackObjectiveId: null
    }
  ];
}

// Genera un obiettivo di eliminazione per un determinato giocatore
function createEliminationObjectiveForPlayer(player) {
  const playerLabel = player?.username || "Giocatore sconosciuto";

  return {
    id: `obj_eliminate_${player.id}`,
    type: "eliminate_player",
    label: `Sconfiggi completamente ${playerLabel}.`,
    continentsToConquer: [],
    requiredTerritories: 0,
    minTroopsPerTerritory: 1,
    requiredExtraContinents: 0,
    targetPlayerId: player.id,
    fallbackObjectiveId: "obj_conquer_24_territories"
  };
}

// Assembla il mazzo completo di tutte le carte obiettivo disponibili
function createObjectiveDeckForPlayers(players = []) {
  const baseObjectives = createBaseObjectives();
  const eliminationObjectives = players
    .filter((player) => player && player.id)
    .map(createEliminationObjectiveForPlayer);

  return [...baseObjectives, ...eliminationObjectives];
}

// Crea un clone di un singolo oggetto obiettivo
function cloneObjective(objective) {
  if (!objective || typeof objective !== "object") {
    return null;
  }

  return {
    id: objective.id || null,
    type: objective.type || null,
    label: objective.label || "",
    continentsToConquer: Array.isArray(objective.continentsToConquer)
      ? [...objective.continentsToConquer]
      : [],
    requiredExtraContinents: Number.isInteger(objective.requiredExtraContinents)
      ? objective.requiredExtraContinents
      : 0,
    requiredTerritories: Number.isInteger(objective.requiredTerritories)
      ? objective.requiredTerritories
      : 0,
    minTroopsPerTerritory: Number.isInteger(objective.minTroopsPerTerritory)
      ? objective.minTroopsPerTerritory
      : 1,
    targetPlayerId: objective.targetPlayerId || null,
    fallbackObjectiveId: objective.fallbackObjectiveId || null
  };
}

// Prende un oggetto giocatore e lo normalizza per la partita
function normalizePlayer(player, index = 0) {
  const normalizedId = player?.id || `player_${index + 1}`;
  const normalizedName = player?.username || `Giocatore ${index + 1}`;

  return {
    ...player,
    id: normalizedId,
    username: normalizedName,
    eliminated: Boolean(player?.eliminated),
    secretObjective: cloneObjective(player?.secretObjective),
    color: player?.color || getColor(index) 
  };
}

// Assegna in modo ciclico un colore della palette esadecimale
function getColor(index) {
  const colors = ["#ff0000", "#0000ff", "#00ff00", "#ffff00", "#ff00ff", "#00ffff"];
  return colors[index % colors.length];
}

// Processa l'intero elenco dei giocatori della partita
function normalizePlayers(players = []) {
  if (!Array.isArray(players)) return [];
  return players.map((player, index) => normalizePlayer(player, index));
}

// Crea e restituisce un nuovo oggetto di stato per la lobby
function createInitialGameState(players = [], victoryMode = "world") {
  const normalizedPlayers = normalizePlayers(players);
  const isObjectives = victoryMode === "objectives";

  return {
    initialized: true, 
    phase: "setup", 
    round: 1,
    currentPlayerIndex: 0,
    selectedTerritoryId: null,
    pendingAttack: null,
    pendingTroopTransfer: null,
    battle: null,
    winner: null,
    victoryMode: victoryMode,
    objectivesEnabled: isObjectives,
    objectiveDeck: isObjectives ? createObjectiveDeckForPlayers(normalizedPlayers) : [],
    players: normalizedPlayers,
    territories: createEmptyTerritoriesState(),
    continents
  };
}

// Verifica se la partita è attualmente finita
function isGameOverState(state) {
  if (!state || typeof state !== "object") return false;
  if (state.winner) return true;

  const normalizedPhase = typeof state.phase === "string" ? state.phase.trim().toLowerCase() : "";
  return normalizedPhase === "gameOver";
}

// Nasconde gli obiettivi a chi non dovrebbe vederli
function getSanitizedPlayers(players = [], currentPlayerId = null, revealAllObjectives = false) {
  return players.map((player) => {
    const isCurrentPlayer = String(player?.id) === String(currentPlayerId);
    const shouldRevealObjective = revealAllObjectives || isCurrentPlayer;
    const sanitizedCards = isCurrentPlayer ? player.cards : [];

    return {
      ...player,
      secretObjective: shouldRevealObjective
        ? cloneObjective(player?.secretObjective)
        : null,
      cards: sanitizedCards
    };
  });
}

// Recupera l'oggetto del giocatore di turno attuale
function getCurrentPlayerFromState(state) {
  if (state?.currentPlayer && typeof state.currentPlayer === "object") {
    return state.currentPlayer;
  }
  if (!Array.isArray(state?.players) || !Number.isInteger(state?.currentPlayerIndex)) {
    return null;
  }
  return state.players[state.currentPlayerIndex] || null;
}

// Prende l'intero stato di gioco e lo pulisce prima di inviarlo a uno specifico client
function getSanitizedGameStateForClient(state, clientId) {
  const revealAllObjectives = isGameOverState(state);  
  const rawCurrentPlayer = getCurrentPlayerFromState(state);
  const sanitizedPlayers = getSanitizedPlayers(state.players, clientId, revealAllObjectives);
  
  let sanitizedCurrentPlayer = null;
  // Trova il giocatore di turno attuale nell'elenco di quelli appena nascosti
  if (rawCurrentPlayer && rawCurrentPlayer.id) {
    sanitizedCurrentPlayer = sanitizedPlayers.find(p => p.id === rawCurrentPlayer.id) || null;
  }

  return {
    ...state,
    currentPlayer: sanitizedCurrentPlayer,
    players: sanitizedPlayers,
    
    objectiveDeck: [],
    deck: undefined,
  };
}

module.exports = {
  createInitialGameState,
  createObjectiveDeckForPlayers,
  cloneObjective,
  getSanitizedGameStateForClient,
};