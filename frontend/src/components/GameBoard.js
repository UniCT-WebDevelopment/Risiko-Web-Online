import React, { useMemo, useCallback, memo } from "react";
import worldMapImage from "../immagini/mappa.png";

const MAP_VIEWBOX = "0 0 1600 900";

const CONTINENT_LABELS = {
  north_america: "Nord America",
  south_america: "Sud America",
  europe: "Europa",
  africa: "Africa",
  asia: "Asia",
  oceania: "Oceania"
};

const TERRITORY_POSITIONS = {
  alaska: { x: 120, y: 70 },
  northwest_territory: { x: 270, y: 70 },
  greenland: { x: 560, y: 40 },
  alberta: { x: 250, y: 160 },
  ontario: { x: 360, y: 170 },
  quebec: { x: 465, y: 180 },
  western_united_states: { x: 250, y: 270 },
  eastern_united_states: { x: 370, y: 300 },
  central_america: { x: 260, y: 400 },

  venezuela: { x: 400, y: 490 },
  peru: { x: 380, y: 630 },
  brazil: { x: 500, y: 580 },
  argentina: { x: 410, y: 780 },

  iceland: { x: 700, y: 100 },
  great_britain: { x: 670, y: 230 },
  scandinavia: { x: 800, y: 130 },
  northern_europe: { x: 810, y: 260 },
  western_europe: { x: 700, y: 370 },
  southern_europe: { x: 800, y: 380 },
  ukraine: { x: 930, y: 220 },

  north_africa: { x: 750, y: 550 },
  egypt: { x: 880, y: 510 },
  east_africa: { x: 970, y: 640 },
  congo: { x: 870, y: 690 },
  south_africa: { x: 880, y: 820 },
  madagascar: { x: 1020, y: 820 },

  ural: { x: 1100, y: 160 },
  siberia: { x: 1190, y: 120 },
  yakutsk: { x: 1300, y: 40 },
  kamchatka: { x: 1410, y: 109 },
  irkutsk: { x: 1280, y: 170 },
  mongolia: { x: 1310, y: 280 },
  japan: { x: 1470, y: 270 },
  afghanistan: { x: 1080, y: 310 },
  middle_east: { x: 980, y: 470 },
  india: { x: 1170, y: 490 },
  china: { x: 1250, y: 380 },
  siam: { x: 1290, y: 520 },

  indonesia: { x: 1310, y: 685 },
  new_guinea: { x: 1460, y: 650 },
  western_australia: { x: 1370, y: 820 },
  eastern_australia: { x: 1500, y: 790 }
};

// Restituisce una stringa leggibile per il nome di un continente
function formatContinent(continent) {
  if (!continent) return "Sconosciuto";
  return CONTINENT_LABELS[continent] || String(continent).replaceAll("_", " ");
}

// Imposta il colore di sfondo del badge di una truppa
function getTroopBadgeBackground() {
  return "#07111c";
}

// Restituisce le coordinate di un territorio
function getTerritoryPosition(territoryId, index = 0) {
  if (TERRITORY_POSITIONS[territoryId]) return TERRITORY_POSITIONS[territoryId];

  // Fallback se non presente
  const columns = 7;
  return {
    x: 120 + (index % columns) * 190,
    y: 120 + Math.floor(index / columns) * 115
  };
}

// Estrae tutti i collegamenti a partire da una lista di territori
function createUniqueEdges(territoryList) {
  const edgeMap = new Map();

  // Semplifico i collegamenti
  territoryList.forEach((territory) => {
    (territory.adjacentTo || []).forEach((adjacentId) => {
      const key = [territory.id, adjacentId].sort().join("__");
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          sourceId: territory.id,
          targetId: adjacentId
        });
      }
    });
  });

  return Array.from(edgeMap.values());
}

// Evita che i nomi troppo lunghi dei territori rompano la grafica della mappa
function shortenLabel(value, max = 18) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Genera dinamicamente la stringa delle classi CSS per un nodo/territorio sulla mappa
function buildNodeClassName(nodeState, disabled) {
  return [
    "risk-node",
    nodeState.isSelected ? "is-selected" : "",
    nodeState.isAttackSource ? "is-attack-source" : "",
    nodeState.isAttackTarget ? "is-attack-target" : "",
    nodeState.isSelectableAttackSource ? "can-attack" : "",
    nodeState.isSelectableAttackTarget ? "can-defend" : "",
    disabled ? "is-disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

// Renderizza e gestisce l'interattività di un singolo territorio sulla mappa
const TerritoryNode = memo(function TerritoryNode({
  territory,
  owner,
  position,
  nodeState,
  fill,
  troopBg,
  label,
  disabled,
  phase,
  onSelectTerritory
}) {
  // Gestisce il click sul territorio
  const handleClick = useCallback(() => {
    if (disabled) return;
    if (!territory?.id) return;
    onSelectTerritory?.(territory.id);
  }, [disabled, territory, onSelectTerritory]);

  // Permette a un utente di selezionare il territorio premendo il tasto invio o la barra spaziatrice
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Calcola e memorizza in memoria la stringa delle classi CSS del territorio
  const className = useMemo(
    () => buildNodeClassName(nodeState, disabled),
    [nodeState, disabled]
  );

  // Crea un'etichetta con i dati correnti del territorio
  const ariaLabel = useMemo(() => {
    return `${territory.name}, continente ${formatContinent(
      territory.continent
    )}, proprietario ${owner ? owner.username : "nessuno"}, truppe ${
      territory.troops ?? 0
    }, stato ${nodeState.helperLabel}`;
  }, [territory, owner, nodeState]);

  // Disegna graficamente il nodo del territorio
  return (
    <g className={className} transform={`translate(${position.x}, ${position.y})`}>
      {/* Pulsante interattivo del territorio */}
      <circle
        r="36"
        className="risk-node__territory"
        style={{ fill }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={nodeState.isSelected}
        aria-label={ariaLabel}
      />

      {/* Badge del conteggio truppe */}
      <circle
        r="20"
        className="risk-node__troops-bg"
        style={{ fill: troopBg }}
        aria-hidden="true"
      />

      <text
        textAnchor="middle"
        dominantBaseline="middle"
        dy="1"
        className="risk-node__troops"
        aria-hidden="true"
      >
        {territory.troops ?? 0}
      </text>

      <g transform="translate(-82, 52)" aria-hidden="true">
        <rect
          width="164"
          height="42"
          rx="21"
          className="risk-node__label-bg"
        />
        <text
          x="82"
          y="26"
          textAnchor="middle"
          className="risk-node__label"
        >
          {label}
        </text>
      </g>
    </g>
  );
});

// Componente GameBoard, cioè il tabellone di gioco
function GameBoard({
  territories = {},
  players = [],
  selectedTerritoryId = null,
  onSelectTerritory,
  disabled = false,
  currentPlayerId = null,
  attackSourceTerritoryId = null,
  attackTargetTerritoryId = null,
  phase = "",
  pendingAttack = null,
  battle = null
}) {
  // Lista dei territori
  const territoryList = useMemo(() => Object.values(territories), [territories]);

  // Trasforma l'array dei giocatori in un dizionario
  const playersById = useMemo(() => {
    return players.reduce((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});
  }, [players]);

  // Ricava il territorio attualmente selezionato
  const selectedTerritory = useMemo(() => {
    if (!selectedTerritoryId) return null;
    return territories[selectedTerritoryId] || null;
  }, [territories, selectedTerritoryId]);

  const attackSourceId = pendingAttack?.attackerTerritoryId || attackSourceTerritoryId || null;
  const attackTargetId = pendingAttack?.defenderTerritoryId || attackTargetTerritoryId || null;

  // Calcola l'insieme dei bersagli nemici adiacenti che possono essere attaccati
  const validAttackTargets = useMemo(() => {
    if (!attackSourceId || !territories[attackSourceId]) {
      return new Set();
    }

    const source = territories[attackSourceId];
    const sourceOwnerId = source.ownerId;
    const adjacent = Array.isArray(source.adjacentTo) ? source.adjacentTo : [];

    // Filtra la lista scartando i propri territori e tenendo solo quelli che hanno un proprietario diverso
    return new Set(
      adjacent.filter((territoryId) => {
        const candidate = territories[territoryId];
        if (!candidate) return false;
        return candidate.ownerId && candidate.ownerId !== sourceOwnerId;
      })
    );
  }, [attackSourceId, territories]);

  const edges = useMemo(() => createUniqueEdges(territoryList), [territoryList]);

  // Memorizza l'array completo di tutti i territori arricchiti pronte per il rendering
  const nodeDataList = useMemo(() => {
    // Recupera il giocatore che possiede un determinato territorio
    function getOwner(territory) {
      return playersById[territory.ownerId] || null;
    }

    // Verifica se un determinato territorio soddisfa tutte le regole per poter iniziare un attacco
    function canBeAttackSource(territory) {
      if (!territory) return false;
      if (territory.ownerId !== currentPlayerId) return false;
      if ((territory.troops ?? 0) < 2) return false;

      // Cerca almeno un territorio adiacente che appartiene a un avversario
      const adjacent = Array.isArray(territory.adjacentTo) ? territory.adjacentTo : [];
      return adjacent.some((adjacentId) => {
        const adjacentTerritory = territories[adjacentId];
        return (
          adjacentTerritory &&
          adjacentTerritory.ownerId !== null &&
          adjacentTerritory.ownerId !== currentPlayerId
        );
      });
    }

    // Verifica se un territorio può essere selezionato come bersaglio valido
    function canBeAttackTarget(territory) {
      if (!territory || !attackSourceId) return false;
      return validAttackTargets.has(territory.id);
    }

    // Calcola lo stato logico e visivo completo di un territorio
    function getTerritoryState(territory) {
      const isSelected = selectedTerritoryId === territory.id;
      const isAttackSource = attackSourceId === territory.id;
      const isAttackTarget = attackTargetId === territory.id;
      const isOwnedByCurrentPlayer = territory.ownerId === currentPlayerId;
      const isSelectableAttackSource = phase === "attack" && canBeAttackSource(territory);
      const isSelectableAttackTarget = phase === "attack" && canBeAttackTarget(territory);

      let helperLabel = "Territorio selezionabile";

      if (phase === "attack") {
        if (isAttackSource) helperLabel = "Territorio attaccante selezionato";
        else if (isAttackTarget) helperLabel = "Territorio difensore selezionato";
        else if (isSelectableAttackTarget) helperLabel = "Bersaglio attaccabile";
        else if (isSelectableAttackSource) helperLabel = "Può attaccare";
        else if (isOwnedByCurrentPlayer) helperLabel = "Territorio controllato";
        else helperLabel = "Territorio avversario";
      } else {
        helperLabel = isOwnedByCurrentPlayer ? "Territorio controllato" : "Territorio avversario";
      }

      return {
        isSelected,
        isAttackSource,
        isAttackTarget,
        isSelectableAttackSource,
        isSelectableAttackTarget,
        helperLabel
      };
    }

    // Cicla sull'array di tutti i territori e trasforma ciascun territorio in un oggetto completo di rendering
    return territoryList.map((territory, index) => {
      const owner = getOwner(territory);
      const position = getTerritoryPosition(territory.id, index);
      const nodeState = getTerritoryState(territory);
      const fill = owner?.color || "#94a3b8";
      const troopBg = getTroopBadgeBackground();
      const label = shortenLabel(territory.name, 18);

      return {
        territory,
        owner,
        position,
        nodeState,
        fill,
        troopBg,
        label
      };
    });
  }, [
    territoryList,
    playersById,
    currentPlayerId,
    territories,
    attackSourceId,
    attackTargetId,
    selectedTerritoryId,
    phase,
    validAttackTargets
  ]);

  // Selezionando l'attaccante, trasforma l'array dei collegamenti in una lista di elementi grafici SVG
  const renderedEdges = useMemo(() => {
    return edges.map((edge) => {
      const source = getTerritoryPosition(edge.sourceId);
      const target = getTerritoryPosition(edge.targetId);

      return (
        <line
          key={`${edge.sourceId}-${edge.targetId}`}
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          className={[
            "risk-edge",
            attackSourceId === edge.sourceId || attackSourceId === edge.targetId
              ? "risk-edge--active"
              : ""
          ]
            .filter(Boolean)
            .join(" ")}
        />
      );
    });
  }, [edges, attackSourceId]);

  // Trasforma l'array di territori nella lista di componenti
  const renderedNodes = useMemo(() => {
    return nodeDataList.map((node) => (
      <TerritoryNode
        key={node.territory.id}
        territory={node.territory}
        owner={node.owner}
        position={node.position}
        nodeState={node.nodeState}
        fill={node.fill}
        troopBg={node.troopBg}
        label={node.label}
        disabled={disabled}
        phase={phase}
        onSelectTerritory={onSelectTerritory}
      />
    ));
  }, [nodeDataList, disabled, phase, onSelectTerritory]);

  if (territoryList.length === 0) {
    return (
      <div className="risk-board-scope">
        <div className="board-empty-state text-center text-white py-5">
          <h3>Caricamento mappa in corso...</h3>
        </div>
      </div>
    );
  }

  // Rendering grafico
  return (
    <section className="risk-board-scope">
      <div className="gameboard-shell gameboard-shell--wide">
        <div className="gameboard-toolbar">
          <div className="gameboard-headings">
            <p className="gameboard-subtitle text-light">
              {phase === "attack"
                ? "Seleziona un tuo territorio attaccante e poi un territorio confinante nemico."
                : "Clicca un territorio per gestire i rinforzi e spostamenti."}
            </p>
          </div>

          {selectedTerritory && (
            <div className="gameboard-stats">
              <span className="gameboard-stat text-warning" title={selectedTerritory.name}>
                Selezionato: <strong>{shortenLabel(selectedTerritory.name, 18)}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="gameboard-legend">
          <span className="legend-pill legend-pill--owned bg-dark border border-secondary text-light">Tuoi territori</span>
          <span className="legend-pill legend-pill--enemy bg-dark border border-secondary text-light">Avversari</span>
          <span className="legend-pill legend-pill--source bg-dark border border-danger text-light">Attaccante</span>
          <span className="legend-pill legend-pill--target bg-dark border border-info text-light">Bersaglio</span>
        </div>

        <div className="gameboard-layout gameboard-layout--single">
          <div className="gameboard-map-card gameboard-map-card--fullscreenish">
            <svg
              className="risk-map risk-map--wide w-100 h-auto"
              viewBox={MAP_VIEWBOX}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Mappa geografica del tabellone Risiko"
            >
              {/* Definisce un clip path per arrotondare gli angoli all'immagine di sfondo */}
              <defs>
                <clipPath id="riskMapClip">
                  <rect x="0" y="0" width="1600" height="900" rx="34" ry="34" />
                </clipPath>
              </defs>

              <rect x="0" y="0" width="1600" height="900" rx="34" className="risk-map__ocean" fill="#0f172a" />

              <image
                href={worldMapImage}
                x="0"
                y="0"
                width="1600"
                height="900"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#riskMapClip)"
                className="risk-map__background-image opacity-50"
                aria-hidden="true"
              />

              <g className="risk-map__edges" aria-hidden="true">
                {renderedEdges}
              </g>

              <g className="risk-map__nodes">{renderedNodes}</g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(GameBoard);