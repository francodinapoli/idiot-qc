-- Ejecutado al crear el volumen de MySQL (docker-entrypoint-initdb.d)

CREATE TABLE IF NOT EXISTS qc_settings (
  id INT PRIMARY KEY,
  weights JSON NOT NULL
);

INSERT IGNORE INTO qc_settings (id, weights)
VALUES (1, JSON_OBJECT('C', 10, 'M', 3, 'm', 1));

CREATE TABLE IF NOT EXISTS qc_sessions (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL,
  sn VARCHAR(512) NOT NULL DEFAULT '',
  pin VARCHAR(512) NOT NULL DEFAULT '',
  armo VARCHAR(512) NOT NULL DEFAULT '',
  reviso VARCHAR(512) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL,
  fpy INT NOT NULL DEFAULT 0,
  checks JSON NOT NULL,
  embalo VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  saved_at DATETIME(3) NULL,
  INDEX idx_qc_sessions_created (created_at),
  INDEX idx_qc_sessions_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qc_custom_products (
  product_id VARCHAR(32) PRIMARY KEY,
  definition JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qc_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qc_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
