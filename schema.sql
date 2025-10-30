-- OAuth Gateway Database Schema (MySQL)

-- Users table (stores federated user identities)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255),
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_provider_user (provider, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OAuth clients (registered applications)
CREATE TABLE IF NOT EXISTS oauth_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_description TEXT,
    redirect_uris JSON NOT NULL,
    allowed_scopes JSON DEFAULT ('["openid", "profile", "email"]'),
    grant_types JSON DEFAULT ('["authorization_code", "refresh_token"]'),
    is_confidential BOOLEAN DEFAULT true,
    logo_url TEXT,
    website_url TEXT,
    privacy_policy_url TEXT,
    terms_of_service_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,
    INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Authorization codes (short-lived codes for OAuth flow)
CREATE TABLE IF NOT EXISTS authorization_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT,
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_client_id (client_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Access tokens
CREATE TABLE IF NOT EXISTS access_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(500) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    scope TEXT,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_client_id (client_id),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(500) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    scope TEXT,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN DEFAULT false,
    access_token_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_client_id (client_id),
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (access_token_id) REFERENCES access_tokens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User consents (remember which apps user has authorized)
CREATE TABLE IF NOT EXISTS user_consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    scope TEXT,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT false,
    UNIQUE KEY unique_user_client (user_id, client_id),
    INDEX idx_user_client (user_id, client_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cleanup procedure for expired tokens
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS cleanup_expired_tokens()
BEGIN
    DELETE FROM authorization_codes WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
    DELETE FROM access_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    DELETE FROM refresh_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
END$$
DELIMITER ;
