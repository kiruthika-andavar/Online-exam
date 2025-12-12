CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  opt_a TEXT NOT NULL,
  opt_b TEXT NOT NULL,
  opt_c TEXT NOT NULL,
  opt_d TEXT NOT NULL,
  correct CHAR(1) NOT NULL CHECK (correct IN ('A','B','C','D'))
);

CREATE TABLE IF NOT EXISTS exams(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 600
);

CREATE TABLE IF NOT EXISTS exam_questions(
  exam_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS attempts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  score INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS responses(
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer CHAR(1) CHECK (answer IN ('A','B','C','D')),
  PRIMARY KEY (attempt_id, question_id)
);

-- demo data
INSERT INTO exams(title,duration_sec) VALUES ('Sample MCQ Test', 180);
INSERT INTO questions(text,opt_a,opt_b,opt_c,opt_d,correct) VALUES
('2 + 2 = ?','3','4','5','6','B'),
('Capital of India?','Mumbai','Delhi','Kolkata','Chennai','B'),
('HTTP status for Not Found?','200','301','404','500','C');
INSERT INTO exam_questions(exam_id,question_id)
SELECT 1, id FROM questions;