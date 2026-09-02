const gameEngine = require("../game/gameEngine");

const ALLOWED_VICTORY_MODES = ["world", "objectives"];

// Inizializza una nuova partita.
function createGame(players, options = {}) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 6) {
    throw new Error("Devi inviare un array di giocatori (da 2 a 6).");
  }

  const victoryMode = typeof options?.victoryMode === "string"
    ? options.victoryMode.trim().toLowerCase()
    : "world";

  if (!ALLOWED_VICTORY_MODES.includes(victoryMode)) {
    throw new Error("Modalità vittoria non valida. Usa 'world' oppure 'objectives'.");
  }

  // Delega della creazione al motore di gioco
  return gameEngine.startNewGame(players, { victoryMode });
}

// Gestisce l'esecuzione di un'azione di gioco
function processGameAction(action, state, userId, payload = {}) {
  if (!state) {
    throw new Error("Partita non trovata o scaduta.");
  }

  // Instradamento dell'azione
  switch (action) {
    // Selezione di un territorio (per posizionare rinforzi o pianificare un attacco)
    case "select_territory":
      if (!payload.territoryId) throw new Error("Devi specificare l'ID del territorio.");
      return gameEngine.selectTerritory(state, userId, payload.territoryId);

    // Posizionamento di un'armata sul territorio selezionato
    case "reinforce":
      return gameEngine.reinforceSelectedTerritory(state, userId);

    // Esecuzione di un attacco lanciando i dadi
    case "attack":
      const attackDice = Number(payload.attackDice);
      if (!Number.isInteger(attackDice) || attackDice < 1 || attackDice > 3) {
        throw new Error("Devi specificare un numero di dadi attacco valido (1-3).");
      }
      return gameEngine.attackTerritory(state, userId, attackDice);

    // Trasferimento truppe verso un territorio conquistato
    case "transfer_troops":
      const troops = Number(payload.troops);
      if (!Number.isInteger(troops) || troops < 1) {
        throw new Error("Devi specificare un numero di truppe valido.");
      }
      return gameEngine.transferConquestTroops(state, userId, troops);

    // Conclusione del turno 
    case "end_turn":
      return gameEngine.endTurn(state, userId);

    default:
      throw new Error(`Azione non riconosciuta: ${action}`);
  }
}

module.exports = {
  createGame,
  processGameAction
};