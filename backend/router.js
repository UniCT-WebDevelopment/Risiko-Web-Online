const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("./db");

const router = express.Router();

// Numero di cicli di hashing
const SALT_ROUNDS = 10;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Genera un token univoco
const generateSessionId = () => crypto.randomBytes(32).toString('hex');

// Route registrazione user
router.post("/register", async (req, res, next) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Formato email non valido" });
  }

  try {
    const newUserId = crypto.randomUUID();

    // Hash della password tramite bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const sessionId = generateSessionId();

    // Registrazione user nel db
    await db.execute(
      "INSERT INTO users (id, username, email, password, session_id) VALUES (?, ?, ?, ?, ?)",
      [newUserId, username, email, hashedPassword, sessionId]
    );
    
    res.status(201).json({ message: "Registrazione completata", session_id: sessionId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
       return res.status(409).json({ error: "Username o Email già in uso." });
    }
    next(err); 
  }
});

// Route per il login dell'utente
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email e password sono obbligatorie" });
  }

  try {
    // Cerchiamo lo user con l'email richiesta
    const [users] = await db.execute(
      "SELECT id, password FROM users WHERE email = ?",
      [email]
    );

    // Verifica se l'email corrisponde
    if (users.length > 0) {
      const user = users[0];

      // Confronta la password in chiaro con l'hash salvato nel DB
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        const sessionId = generateSessionId();
        
        // Salva/aggiorna la sessione corrente dell'utente nel database
        await db.execute("UPDATE users SET session_id = ? WHERE id = ?", [sessionId, user.id]);
        
        res.status(200).json({ message: "Login effettuato", session_id: sessionId });
      } else {
        res.status(401).json({ error: "Credenziali non valide" });
      }
    } else {
      res.status(401).json({ error: "Credenziali non valide" });
    }
  } catch (err) {
    next(err);
  }
});

// Route per recuperare il profilo dell'utente attualmente autenticato
router.get("/me", async (req, res, next) => {
  // Estrazione del token di sessione dall'header
  const sessionId = req.headers["x-session-id"];

  if (!sessionId) return res.status(401).json({ error: "Non autorizzato" });

  try {
    // Cerca l'utente nel DB associato a quel session_id
    const [users] = await db.execute("SELECT username, games_played, games_won FROM users WHERE session_id = ?", [sessionId]);

    if (users.length > 0) {
      res.status(200).json(users[0]);
    } else {
      res.status(401).json({ error: "Sessione scaduta" });
    }
  } catch (err) {
    next(err);
  }
});

// Route per recuperare le statistiche giocatore
router.get("/user/:id/stats", async (req, res, next) => {
  try {
    // Esegue la query cercando l'utente tramite l'ID passato nell'URL
    const [users] = await db.execute("SELECT username, games_played, games_won FROM users WHERE id = ?", [req.params.id]);

    if (users.length > 0) {
      res.status(200).json(users[0]);
    } else {
      res.status(404).json({ error: "Utente non trovato" });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;