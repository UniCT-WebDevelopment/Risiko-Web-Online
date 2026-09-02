CREATE DATABASE IF NOT EXISTS risiko_db;
USE risiko_db;

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    session_id VARCHAR(100) UNIQUE DEFAULT NULL,
    games_played INT DEFAULT 0, 
    games_won INT DEFAULT 0 
);

CREATE TABLE lobbies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id VARCHAR(36) NOT NULL,
    status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
    FOREIGN KEY (host_id) REFERENCES users(id)
);

CREATE TABLE lobby_players (
    lobby_id INT,
    user_id VARCHAR(36),
    PRIMARY KEY (lobby_id, user_id),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);