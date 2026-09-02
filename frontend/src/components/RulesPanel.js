import React, { memo } from "react";

// Componente per visualizzare le regole all'interno di una partita
function RulesPanel() {
  return (
    <div className="app-panel bg-secondary rounded shadow-sm mt-3 p-3">
      <h5 className="text-warning mb-3 border-bottom border-dark pb-2">Regole Rapide</h5>
      <div className="row text-light small">
        <div className="col-md-4 mb-2">
          <strong className="text-white">Rinforzi</strong><br />
          <span className="opacity-75">
            Ricevi <strong>1 armata ogni 3 territori</strong> posseduti (minimo garantito: 3 armate a turno).
          </span>
        </div>
        <div className="col-md-4 mb-2">
          <strong className="text-white">Combattimento</strong><br />
          <span className="opacity-75">
            L'attaccante lancia max 3 dadi, il difensore max 3, calcolato in base al numero di truppe presenti nel territorio.
            Si confrontano a coppie dal più alto al più basso. 
            <strong className="text-warning"> In caso di pareggio, vince sempre il difensore.</strong>
          </span>
        </div>
        <div className="col-md-4 mb-2">
          <strong className="text-white">Bonus Rinforzi per Continenti</strong><br />
          <span className="opacity-75">
            Asia: <strong className="text-warning">+7</strong> | N. America / Europa: <strong className="text-warning">+5</strong><br />
            Africa: <strong className="text-warning">+3</strong> | S. America / Oceania: <strong className="text-warning">+2</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(RulesPanel);