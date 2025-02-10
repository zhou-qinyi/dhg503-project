-- Create a sample table 'dynasty'
CREATE TABLE IF NOT EXISTS dynasty (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial data
INSERT INTO dynasty (name)
VALUES ('Ming'), ('Qing'), ('Joseon');
