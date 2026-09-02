//Array di 42 oggetti che rappresentano tutti i territori del tabellone
const rawTerritories = [
  { id: "alaska", name: "Alaska", continent: "north_america", neighbors: ["northwest_territory", "alberta", "kamchatka"] },
  { id: "northwest_territory", name: "Northwest Territory", continent: "north_america", neighbors: ["alaska", "alberta", "ontario", "greenland"] },
  { id: "greenland", name: "Greenland", continent: "north_america", neighbors: ["northwest_territory", "ontario", "quebec", "iceland"] },
  { id: "alberta", name: "Alberta", continent: "north_america", neighbors: ["alaska", "northwest_territory", "ontario", "western_united_states"] },
  { id: "ontario", name: "Ontario", continent: "north_america", neighbors: ["northwest_territory", "greenland", "quebec", "eastern_united_states", "western_united_states", "alberta"] },
  { id: "quebec", name: "Quebec", continent: "north_america", neighbors: ["ontario", "greenland", "eastern_united_states"] },
  { id: "western_united_states", name: "Western United States", continent: "north_america", neighbors: ["alberta", "ontario", "eastern_united_states", "central_america"] },
  { id: "eastern_united_states", name: "Eastern United States", continent: "north_america", neighbors: ["western_united_states", "ontario", "quebec", "central_america"] },
  { id: "central_america", name: "Central America", continent: "north_america", neighbors: ["western_united_states", "eastern_united_states", "venezuela"] },

  { id: "venezuela", name: "Venezuela", continent: "south_america", neighbors: ["central_america", "peru", "brazil"] },
  { id: "peru", name: "Peru", continent: "south_america", neighbors: ["venezuela", "brazil", "argentina"] },
  { id: "brazil", name: "Brazil", continent: "south_america", neighbors: ["venezuela", "peru", "argentina", "north_africa"] },
  { id: "argentina", name: "Argentina", continent: "south_america", neighbors: ["peru", "brazil"] },

  { id: "iceland", name: "Iceland", continent: "europe", neighbors: ["greenland", "great_britain", "scandinavia"] },
  { id: "scandinavia", name: "Scandinavia", continent: "europe", neighbors: ["iceland", "great_britain", "northern_europe", "ukraine"] },
  { id: "ukraine", name: "Ukraine", continent: "europe", neighbors: ["scandinavia", "northern_europe", "southern_europe", "ural", "afghanistan", "middle_east"] },
  { id: "great_britain", name: "Great Britain", continent: "europe", neighbors: ["iceland", "scandinavia", "northern_europe", "western_europe"] },
  { id: "northern_europe", name: "Northern Europe", continent: "europe", neighbors: ["great_britain", "scandinavia", "ukraine", "southern_europe", "western_europe"] },
  { id: "western_europe", name: "Western Europe", continent: "europe", neighbors: ["great_britain", "northern_europe", "southern_europe", "north_africa"] },
  { id: "southern_europe", name: "Southern Europe", continent: "europe", neighbors: ["western_europe", "northern_europe", "ukraine", "middle_east", "egypt", "north_africa"] },

  { id: "north_africa", name: "North Africa", continent: "africa", neighbors: ["brazil", "western_europe", "southern_europe", "egypt", "east_africa", "congo"] },
  { id: "egypt", name: "Egypt", continent: "africa", neighbors: ["southern_europe", "middle_east", "east_africa", "north_africa"] },
  { id: "east_africa", name: "East Africa", continent: "africa", neighbors: ["egypt", "middle_east", "madagascar", "south_africa", "congo", "north_africa"] },
  { id: "congo", name: "Congo", continent: "africa", neighbors: ["north_africa", "east_africa", "south_africa"] },
  { id: "south_africa", name: "South Africa", continent: "africa", neighbors: ["congo", "east_africa", "madagascar"] },
  { id: "madagascar", name: "Madagascar", continent: "africa", neighbors: ["east_africa", "south_africa"] },

  { id: "ural", name: "Ural", continent: "asia", neighbors: ["ukraine", "siberia", "china", "afghanistan"] },
  { id: "siberia", name: "Siberia", continent: "asia", neighbors: ["ural", "yakutsk", "irkutsk", "mongolia", "china"] },
  { id: "yakutsk", name: "Yakutsk", continent: "asia", neighbors: ["siberia", "kamchatka", "irkutsk"] },
  { id: "kamchatka", name: "Kamchatka", continent: "asia", neighbors: ["yakutsk", "irkutsk", "mongolia", "japan", "alaska"] },
  { id: "irkutsk", name: "Irkutsk", continent: "asia", neighbors: ["siberia", "yakutsk", "kamchatka", "mongolia"] },
  { id: "mongolia", name: "Mongolia", continent: "asia", neighbors: ["siberia", "irkutsk", "kamchatka", "japan", "china"] },
  { id: "japan", name: "Japan", continent: "asia", neighbors: ["kamchatka", "mongolia"] },
  { id: "afghanistan", name: "Afghanistan", continent: "asia", neighbors: ["ukraine", "ural", "china", "india", "middle_east"] },
  { id: "middle_east", name: "Middle East", continent: "asia", neighbors: ["ukraine", "afghanistan", "india", "southern_europe", "egypt", "east_africa"] },
  { id: "india", name: "India", continent: "asia", neighbors: ["middle_east", "afghanistan", "china", "siam"] },
  { id: "china", name: "China", continent: "asia", neighbors: ["ural", "siberia", "mongolia", "siam", "india", "afghanistan"] },
  { id: "siam", name: "Siam", continent: "asia", neighbors: ["india", "china", "indonesia"] },
  
  { id: "indonesia", name: "Indonesia", continent: "oceania", neighbors: ["siam", "new_guinea", "western_australia"] },
  { id: "new_guinea", name: "New Guinea", continent: "oceania", neighbors: ["indonesia", "western_australia", "eastern_australia"] },
  { id: "western_australia", name: "Western Australia", continent: "oceania", neighbors: ["indonesia", "new_guinea", "eastern_australia"] },
  { id: "eastern_australia", name: "Eastern Australia", continent: "oceania", neighbors: ["western_australia", "new_guinea"] }
];

//Un dizionario che mappa i 6 continenti
const continents = {
  north_america: { id: "north_america", name: "North America", bonus: 5, territories: [] },
  south_america: { id: "south_america", name: "South America", bonus: 2, territories: [] },
  europe: { id: "europe", name: "Europe", bonus: 5, territories: [] },
  africa: { id: "africa", name: "Africa", bonus: 3, territories: [] },
  asia: { id: "asia", name: "Asia", bonus: 7, territories: [] },
  oceania: { id: "oceania", name: "Oceania", bonus: 2, territories: [] }
};

//Aggiunge l'ID di ogni territorio nell'array territories del rispettivo continente
const territories = rawTerritories.map((territory) => {
  if (continents[territory.continent]) {
    continents[territory.continent].territories.push(territory.id);
  }

  return {
    ...territory,
    adjacentTo: [...new Set(territory.neighbors || [])] // contiene la lista dei vicini, ma pulita da eventuali doppioni
  };
});

//Validazione della mappa
function validateMapData(territoriesList, continentsMap) {
  // Serve per verificare se un territorio esiste
  const territoryIds = new Set(territoriesList.map((territory) => territory.id));
  
  //Serve per trovare un territorio partendo dal suo ID
  const territoriesById = territoriesList.reduce((acc, territory) => {
    acc[territory.id] = territory;
    return acc;
  }, {});

  for (const territory of territoriesList) {
    if (!territory.id || !territory.name || !territory.continent) {
      throw new Error(`Territorio non valido: dati mancanti (${territory.id || "unknown"}).`);
    }

    if (!continentsMap[territory.continent]) {
      throw new Error(`Continente non valido per il territorio ${territory.id}.`);
    }

    if (!Array.isArray(territory.adjacentTo)) {
      throw new Error(`Lista adiacenze non valida per il territorio ${territory.id}.`);
    }

    for (const adjacentId of territory.adjacentTo) {
      if (!territoryIds.has(adjacentId)) {
        throw new Error(
          `Il territorio ${territory.id} contiene un'adiacenza non valida: ${adjacentId}.`
        );
      }
    }
  }

  for (const territory of territoriesList) {
    for (const adjacentId of territory.adjacentTo) {
      const adjacentTerritory = territoriesById[adjacentId];

      if (!adjacentTerritory) {
        throw new Error(`Territorio adiacente non trovato: ${adjacentId}.`);
      }

      if (!adjacentTerritory.adjacentTo.includes(territory.id)) {
        throw new Error(
          `Adiacenza non simmetrica tra ${territory.id} e ${adjacentId}.`
        );
      }
    }
  }
}

validateMapData(territories, continents);

module.exports = {
  territories,
  continents
};