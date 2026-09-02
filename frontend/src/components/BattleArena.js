import React, { useState, useEffect } from 'react';

// Animazione del lancio dei dadi per visualizzare l'esito di uno scontro
function BattleArena({ arenaData }) {
  const { 
    battle, 
    attackerName, 
    defenderName, 
    attackerColor, 
    defenderColor, 
    attackerTerritory, 
    defenderTerritory 
  } = arenaData;

  const { attackRolls, defendRolls, attackerLosses, defenderLosses, conquered } = battle;

  // Array della stessa lunghezza di attackRolls/defendRolls, riempiendo temporaneamente con il valore 1
  const [displayAttack, setDisplayAttack] = useState(attackRolls.map(() => 1));
  const [displayDefend, setDisplayDefend] = useState(defendRolls.map(() => 1));

  const [isRolling, setIsRolling] = useState(true);

  // Effetto rullo dei dadi
  useEffect(() => {
    let interval;
    if (isRolling) {
      // Cambia i numeri dei dadi nel tempo
      interval = setInterval(() => {
        setDisplayAttack(attackRolls.map(() => Math.floor(Math.random() * 6) + 1));
        setDisplayDefend(defendRolls.map(() => Math.floor(Math.random() * 6) + 1));
      }, 80);

      // Ferma i dadi e mostra i numeri veri
      setTimeout(() => {
        setIsRolling(false);
        setDisplayAttack(attackRolls);
        setDisplayDefend(defendRolls);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isRolling, attackRolls, defendRolls]);

  // Rendering grafico
  return (
    <div className="d-flex justify-content-center align-items-center" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <style>{`
        @keyframes arenaPop {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Applica un'animazione di comparsa con effetto "rimbalzo" elastico */}
      <div className="p-4 rounded text-center text-white shadow-lg" style={{
        backgroundColor: '#1e293b', border: '1px solid #334155', minWidth: '450px',        
        animation: 'arenaPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
      }}>
        <h3 className="mb-4 fw-bold text-uppercase text-light" style={{ letterSpacing: '2px' }}>
          Scontro in corso
        </h3>
        
        <div className="d-flex justify-content-between align-items-stretch mb-4 gap-4">
          {/* Box Attaccante */}
          <div className="flex-fill p-3 rounded shadow-sm" style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderTop: `4px solid ${attackerColor}` }}>
            <h5 className="mb-0 fw-bold text-truncate" style={{ maxWidth: '150px' }}>{attackerName}</h5>
            <small className="text-secondary d-block text-truncate" style={{ maxWidth: '150px' }}>{attackerTerritory}</small>
            <div className="d-flex justify-content-center gap-2 mt-3">
              {displayAttack.map((val, i) => (
                <div key={i} className="bg-danger rounded d-flex align-items-center justify-content-center fw-bold fs-4 text-white shadow" style={{ width: '45px', height: '45px', border: '2px solid rgba(255,255,255,0.2)' }}>
                  {val}
                </div>
              ))}
            </div>
          </div>

          <div className="d-flex align-items-center fw-bold fs-3 text-secondary">VS</div>

          {/* Box Difensore */}
          <div className="flex-fill p-3 rounded shadow-sm" style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderTop: `4px solid ${defenderColor}` }}>
            <h5 className="mb-0 fw-bold text-truncate" style={{ maxWidth: '150px' }}>{defenderName}</h5>
            <small className="text-secondary d-block text-truncate" style={{ maxWidth: '150px' }}>{defenderTerritory}</small>
            <div className="d-flex justify-content-center gap-2 mt-3">
              {displayDefend.map((val, i) => (
                <div key={i} className="bg-info rounded d-flex align-items-center justify-content-center fw-bold fs-4 text-dark shadow" style={{ width: '45px', height: '45px', border: '2px solid rgba(255,255,255,0.2)' }}>
                  {val}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risultato che compare quando i dadi si fermano */}
        <div style={{ minHeight: '60px', transition: 'opacity 0.4s ease-in-out', opacity: isRolling ? 0 : 1 }}>
          {!isRolling && (
            conquered ? (
              <div className="text-success fs-5 fw-bold bg-success bg-opacity-25 p-2 rounded border border-success">
                Vittoria! Territorio Conquistato
              </div>
            ) : (
              <div className="d-flex justify-content-center gap-4 fs-6 fw-bold">
                <span className="text-danger bg-danger bg-opacity-10 p-2 px-3 rounded border border-danger border-opacity-25">Perdite Att: -{attackerLosses}</span>
                <span className="text-info bg-info bg-opacity-10 p-2 px-3 rounded border border-info border-opacity-25">Perdite Dif: -{defenderLosses}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default BattleArena;