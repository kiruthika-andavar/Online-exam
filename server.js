const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const SECRET = 'supersecret_change_me';

// Create exam.db from db.sql on first run
if (!fs.existsSync('./exam.db')) {
  const schema = fs.readFileSync('./db.sql', 'utf8');
  fs.writeFileSync('./exam.db', '');
  const tmp = new sqlite3.Database('./exam.db');
  tmp.exec(schema, () => tmp.close());
}

const db = new sqlite3.Database('./exam.db');

function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({error:'No token'});
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch(e){ return res.status(401).json({error:'Invalid token'}); }
}

/* ---------- Auth ---------- */
app.post('/api/signup', async (req,res)=>{
  const {email,name,password} = req.body;
  if(!email || !name || !password) return res.status(400).json({error:'Missing fields'});
  const hash = await bcrypt.hash(password,10);
  db.run('INSERT INTO users(email,name,password_hash) VALUES(?,?,?)',
    [email,name,hash], function(err){
      if(err) return res.status(400).json({error:'Email exists'});
      const token = jwt.sign({id:this.lastID,email,name}, SECRET, {expiresIn:'2h'});
      res.json({token});
    });
});

app.post('/api/login', (req,res)=>{
  const {email,password}=req.body;
  db.get('SELECT * FROM users WHERE email=?',[email], async (err,row)=>{
    if(err||!row) return res.status(401).json({error:'Invalid credentials'});
    const ok = await bcrypt.compare(password,row.password_hash);
    if(!ok) return res.status(401).json({error:'Invalid credentials'});
    const token = jwt.sign({id:row.id,email:row.email,name:row.name}, SECRET, {expiresIn:'2h'});
    res.json({token});
  });
});

/* ---------- Profile ---------- */
app.get('/api/me', auth, (req,res)=>{
  db.get('SELECT id,email,name FROM users WHERE id=?',[req.user.id], (e,row)=> res.json(row));
});
app.post('/api/me', auth, (req,res)=>{
  const {name}=req.body;
  db.run('UPDATE users SET name=? WHERE id=?',[name,req.user.id], ()=> res.json({ok:true}));
});
app.post('/api/me/password', auth, async (req,res)=>{
  const {oldPassword,newPassword}=req.body;
  db.get('SELECT password_hash FROM users WHERE id=?',[req.user.id], async (e,row)=>{
    if(!row) return res.status(400).json({error:'User missing'});
    const ok = await bcrypt.compare(oldPassword,row.password_hash);
    if(!ok) return res.status(401).json({error:'Wrong password'});
    const hash = await bcrypt.hash(newPassword,10);
    db.run('UPDATE users SET password_hash=? WHERE id=?',[hash,req.user.id], ()=> res.json({ok:true}));
  });
});

/* ---------- Exams ---------- */
app.get('/api/exams', auth, (req,res)=>{
  db.all('SELECT id,title,duration_sec FROM exams',[],(e,rows)=> res.json(rows));
});

app.post('/api/exams/:id/start', auth, (req,res)=>{
  const examId = req.params.id;
  const now = Math.floor(Date.now()/1000);
  db.run('INSERT INTO attempts(exam_id,user_id,started_at) VALUES(?,?,?)',
    [examId,req.user.id,now], function(){
      const attemptId = this.lastID;
      db.all(`SELECT q.id, q.text, q.opt_a, q.opt_b, q.opt_c, q.opt_d
              FROM questions q JOIN exam_questions eq ON q.id=eq.question_id
              WHERE eq.exam_id=?`, [examId], (e,qs)=>{
        db.get('SELECT duration_sec FROM exams WHERE id=?',[examId],(e2,dur)=>{
          res.json({attemptId, durationSec: dur.duration_sec, questions: qs});
        });
      });
    });
});

app.post('/api/attempts/:aid/answer', auth, (req,res)=>{
  const {questionId, answer} = req.body;
  db.run(`INSERT INTO responses(attempt_id,question_id,answer)
          VALUES(?,?,?)
          ON CONFLICT(attempt_id,question_id) DO UPDATE SET answer=excluded.answer`,
    [req.params.aid, questionId, answer], ()=> res.json({ok:true}));
});

app.post('/api/attempts/:aid/submit', auth, (req,res)=>{
  const aid = req.params.aid;
  const now = Math.floor(Date.now()/1000);
  const sql = `
    SELECT SUM(CASE WHEN q.correct = r.answer THEN 1 ELSE 0 END) AS score
    FROM exam_questions eq
    JOIN questions q ON q.id=eq.question_id
    LEFT JOIN responses r ON r.question_id=q.id AND r.attempt_id=?
    WHERE eq.exam_id = (SELECT exam_id FROM attempts WHERE id=?)
  `;
  db.get(sql,[aid,aid], (e,row)=>{
    const score = row?.score || 0;
    db.run('UPDATE attempts SET submitted_at=?, score=? WHERE id=?',[now,score,aid], ()=>{
      res.json({submitted:true,score});
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));