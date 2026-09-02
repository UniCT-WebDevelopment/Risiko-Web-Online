import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/api';

// Gestisce l'interfaccia e la logica per l'autenticazione utente
const AuthPanel = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Verifica se è login o registrazione
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const data = await loginUser(email, password);
        onLoginSuccess(data.session_id); 
      } else {
        const data = await registerUser(username, email, password);
        onLoginSuccess(data.session_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Grafica
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-light">
      <div className="card bg-secondary p-4 shadow" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="text-center mb-4">{isLogin ? 'Accesso a Risiko' : 'Registrazione'}</h2>
        
        {error && <div className="alert alert-danger p-2">{error}</div>}

        {/* Form login/registrazione */}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Username (univoco)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}
          <div className="mb-3">
            <input
              type="email"
              className="form-control"
              placeholder="Email (univoca)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? 'Attendere...' : (isLogin ? 'Entra' : 'Registrati')}
          </button>
        </form>
        
        {/* Pulsante per passare da login a registrazione */}
        <div className="text-center mt-3">
          <button 
            className="btn btn-link text-light text-decoration-none" 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
          >
            {isLogin ? 'Nuovo giocatore? Registrati qui' : 'Hai già un account? Accedi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPanel;